/**
 * Batch Calendar Event Processing Brain
 *
 * This brain handles the batch processing of unprocessed calendar events
 * using the centralized concurrency controller and cost tracking service.
 *
 * Key Features:
 * - Fetches unprocessed calendar events for all users
 * - Processes events in batches with concurrency limits
 * - Tracks LLM usage costs via centralized cost service
 * - Uses priority-based processing with the concurrency controller
 * - Handles errors gracefully and logs processing results
 *
 * Architecture:
 * - Replaces legacy calendar event processing logic from archive files
 * - Uses centralized services instead of duplicated concurrency/cost logic
 * - Integrates with refactored data layer for storage operations
 * - Follows modern batch processing patterns with rate limiting
 * - Follows DATA_DOCTRINE.md: uses proper schema types, no `any`, graceful error handling
 */

import { llmConcurrencyController } from '../utils/llm-concurrency-controller.js';
import { llmCostService } from '../services/llm-cost.service.js';
import { openRouterService } from '../providers/openrouter.provider.js';
import { storage } from '../data/index.js';
import type { LLMBatchOptions, LLMRequestPriority } from '../types/service-contracts.js';
import type { CalendarEvent, Contact, User } from '../../shared/schema.js';

interface ProcessingResult {
  success: boolean;
  eventId: string;
  data?: unknown;
  error?: unknown;
}

interface UserProcessingResult {
  processed: number;
  errors: number;
}

class BatchProcessCalendarEventsBrain {
  private readonly MODEL_NAME = 'anthropic/claude-3.5-sonnet';
  private readonly ESTIMATED_TOKENS_PER_EVENT = 2000;
  private readonly DEFAULT_BATCH_SIZE = 5;
  private readonly DEFAULT_DELAY_BETWEEN_BATCHES = 1000; // 1 second
  private readonly DEFAULT_DELAY_BETWEEN_USERS = 2000; // 2 seconds

  /**
   * Process all unprocessed calendar events for all users
   * Uses batch processing with concurrency control and cost tracking
   */
  async processAllUsers(): Promise<void> {
    console.log('🚀 Starting batch calendar event processing...');

    try {
      // Fetch all users from storage - using proper schema types
      const users: User[] = await storage.users.getAll();

      if (users.length === 0) {
        console.log('ℹ️ No users found to process');
        return;
      }

      console.log(`👥 Found ${users.length} users to process`);

      let totalProcessed = 0;
      let totalErrors = 0;

      // Process each user sequentially to respect rate limits
      for (const user of users) {
        try {
          const result = await this.processUserEvents(user.id);
          totalProcessed += result.processed;
          totalErrors += result.errors;

          // Add delay between users to respect API rate limits
          if (users.indexOf(user) < users.length - 1) {
            await this.sleep(this.DEFAULT_DELAY_BETWEEN_USERS);
          }
        } catch (error) {
          console.error(`❌ Error processing user ${user.id}:`, error);
          totalErrors++;
        }
      }

      // Log final results and cost summary
      console.log(`✅ Batch processing complete!`);
      console.log(`📊 Events processed: ${totalProcessed}`);
      console.log(`❌ Events failed: ${totalErrors}`);

      // Get daily usage summary from cost service (aggregated across all users)
      // Note: Using first user's ID as a representative for daily usage summary
      if (users.length > 0) {
        const dailyUsage = await llmCostService.getDailyUsage(users[0].id);
        console.log(
          `💰 Daily usage: ${dailyUsage.requests} requests, ~$${dailyUsage.cost.toFixed(2)} cost`
        );
      }
    } catch (error) {
      console.error('💥 Fatal error in batch processing:', error);
      throw error;
    }
  }

  /**
   * Process unprocessed calendar events for a specific user
   * No N+1 queries - fetches all data upfront
   */
  private async processUserEvents(userId: string): Promise<UserProcessingResult> {
    try {
      // Fetch unprocessed events and contacts for this user in parallel
      // This avoids N+1 queries by getting all data upfront
      const [unprocessedEvents, userContacts]: [CalendarEvent[], Contact[]] = await Promise.all([
        storage.calendar.getUnprocessed(userId),
        storage.contacts.getByUserId(userId),
      ]);

      if (unprocessedEvents.length === 0) {
        console.log(`ℹ️ No unprocessed events for user ${userId}`);
        return { processed: 0, errors: 0 };
      }

      console.log(`📅 Processing ${unprocessedEvents.length} events for user ${userId}`);

      // Create batch operations for concurrency controller
      const operations = unprocessedEvents.map((event) => ({
        operation: () => this.processCalendarEvent(event, userContacts, userId),
        userId,
        model: this.MODEL_NAME,
        priority: 'normal' as LLMRequestPriority,
      }));

      // Configure batch processing options
      const batchOptions: LLMBatchOptions = {
        batchSize: this.DEFAULT_BATCH_SIZE,
        delayBetweenBatches: this.DEFAULT_DELAY_BETWEEN_BATCHES,
        timeout: 60000, // 60 second timeout per operation
      };

      // Execute batch processing with concurrency control
      const results = await llmConcurrencyController.executeBatch(operations, batchOptions);

      // Count successes and failures
      const processed = results.filter((r) => r.success).length;
      const errors = results.filter((r) => !r.success).length;

      console.log(`✅ User ${userId}: ${processed} processed, ${errors} errors`);
      return { processed, errors };
    } catch (error) {
      console.error(`❌ Error processing user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Process a single calendar event with LLM analysis
   * Uses proper schema types and graceful error handling
   */
  private async processCalendarEvent(
    event: CalendarEvent,
    contacts: Contact[],
    userId: string
  ): Promise<ProcessingResult> {
    try {
      // Analyze calendar event using OpenRouter with proper types
      const extractedData = await openRouterService.analyzeCalendarEvent(
        event,
        contacts,
        this.MODEL_NAME
      );

      // Track LLM usage for cost monitoring
      await llmCostService.trackUsage(userId, this.ESTIMATED_TOKENS_PER_EVENT, this.MODEL_NAME);

      // Mark event as processed in storage
      const eventHash = storage.calendar.getEventHash(event);
      await storage.calendar.markEventProcessed(
        event.id,
        eventHash,
        true,
        extractedData,
        this.MODEL_NAME
      );

      console.log(`✅ Processed calendar event: ${event.id}`);
      return { success: true, eventId: event.id, data: extractedData };
    } catch (error) {
      console.error(`❌ Error processing calendar event ${event.id}:`, error);

      try {
        // Mark as processed with error (no analysis data available)
        // Graceful error handling - don't fail the entire batch if one event fails to mark
        const eventHash = storage.calendar.getEventHash(event);
        await storage.calendar.markEventProcessed(
          event.id,
          eventHash,
          false,
          undefined,
          this.MODEL_NAME
        );
      } catch (markError) {
        console.error(`❌ Failed to mark event ${event.id} as processed:`, markError);
      }

      return { success: false, eventId: event.id, error };
    }
  }


  /**
   * Helper method to add delays between operations
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const batchProcessCalendarEventsBrain = new BatchProcessCalendarEventsBrain();
