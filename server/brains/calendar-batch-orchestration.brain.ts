import type { CalendarEvent } from '../../shared/schema.js';
import type { ContactData } from '../types/external-apis.js';
import type { CalendarEventAnalysis, StorageInterface } from '../types/service-contracts.js';
import { llmConcurrencyController } from '../utils/llm-concurrency-controller.js';
import { llmCostTracker } from '../utils/llm-cost-tracker.js';
import { CalendarFilterBrain } from './calendar-filter.brain.js';
import { CalendarExtractBrain } from './calendar-extract.brain.js';

// Generic interface for LLM provider
interface LLMProvider {
  generateCompletion(
    model: string,
    messages: unknown[],
    isJson: boolean
  ): Promise<string>;
}

export type BatchOrchestrationInput = {
  events: CalendarEvent[];
  contacts: ContactData[];
  userId: string;
  useFreeModel?: boolean;
};

export type BatchOrchestrationOutput = {
  successfulResults: CalendarEventAnalysis[];
  failedEvents: string[];
  totalProcessed: number;
  totalCost: number;
};

// Default analysis for failed/irrelevant events
const defaultIrrelevantAnalysis: CalendarEventAnalysis = {
  isRelevant: false,
  relevanceReason: 'Filtered by pre-check or error.',
  eventType: 'unknown',
  isClientRelated: false,
  clientEmails: [],
  sessionType: null,
  keyTopics: [],
  actionItems: [],
  notes: '',
  confidence: 0.9,
  suggestedAction: 'ignore',
  processedAt: new Date().toISOString(),
  llmModel: 'unknown',
  eventId: '',
};

export class CalendarBatchOrchestrationBrain {
  private storage: StorageInterface;
  private filterBrain: CalendarFilterBrain;
  private extractBrain: CalendarExtractBrain;

  constructor(storage: StorageInterface) {
    if (!storage) {
      throw new Error('Storage is required for CalendarBatchOrchestrationBrain');
    }
    this.storage = storage;
    this.filterBrain = new CalendarFilterBrain();
    this.extractBrain = new CalendarExtractBrain();
  }

  async execute(
    provider: LLMProvider,
    input: BatchOrchestrationInput
  ): Promise<BatchOrchestrationOutput> {
    const { events, contacts, userId, useFreeModel = false } = input;

    // Get cost-optimized model recommendation
    const costRecommendation = llmCostTracker.getModelRecommendation(
      userId,
      'calendar_analysis',
      events.length * 500 // Estimate 500 tokens per event
    );

    const modelToUse = useFreeModel
      ? 'meta-llama/llama-3.1-8b-instruct:free'
      : costRecommendation.recommendedModel;

    console.log(
      `Processing ${events.length} events with model: ${modelToUse} (${costRecommendation.reason})`
    );
    console.log(`Estimated cost: $${costRecommendation.estimatedCost.toFixed(4)}`);

    // Process events using controlled concurrency
    const operations = events.map((event) => ({
      operation: () => this.processSingleEvent(event, contacts, modelToUse, userId, provider),
      userId,
      model: modelToUse,
      priority: 'medium' as const,
    }));

    const results = await llmConcurrencyController.executeBatch(operations, {
      batchSize: useFreeModel ? 5 : 10, // Smaller batches for free model
      delayBetweenBatches: useFreeModel ? 500 : 200, // Longer delay for free model
    });

    // Extract successful results and handle failures
    const successfulResults: CalendarEventAnalysis[] = [];
    const failedEvents: string[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const event = events[i];

      if (result.success && result.result) {
        successfulResults.push(result.result);
      } else {
        failedEvents.push(event.id);
        console.error(`Failed to process event ${event.id}: ${result.error}`);

        // Create default analysis for failed events
        await this.markAsProcessedPersistent(event, {
          ...defaultIrrelevantAnalysis,
          relevanceReason: `Processing failed: ${result.error}`,
          eventId: event.id,
        });
      }
    }

    if (failedEvents.length > 0) {
      console.warn(`Failed to process ${failedEvents.length} out of ${events.length} events`);
    }

    return {
      successfulResults,
      failedEvents,
      totalProcessed: successfulResults.length,
      totalCost: costRecommendation.estimatedCost,
    };
  }

  /**
   * Process a single calendar event with two-stage analysis (filter + extract)
   */
  private async processSingleEvent(
    event: CalendarEvent,
    contacts: ContactData[],
    model: string,
    userId: string,
    provider: LLMProvider
  ): Promise<CalendarEventAnalysis> {
    // Check if already processed using persistent storage
    if (this.storage?.shouldProcessEvent) {
      const shouldProcess = await this.storage.shouldProcessEvent(event.id);
      if (!shouldProcess) {
        console.log(`Event ${event.id} already processed and unchanged, skipping...`);
        throw new Error('Event already processed');
      }
    }

    try {
      // Stage 1: Relevance filtering (cheap, fast)
      const filterResult = await this.filterBrain.execute(provider, model, {
        event,
        contacts,
      });

      // If not relevant, mark as processed and skip extraction
      if (!filterResult.isRelevant) {
        console.log(`Event ${event.id} filtered as not relevant: ${filterResult.relevanceReason}`);

        const analysis: CalendarEventAnalysis = {
          ...defaultIrrelevantAnalysis,
          relevanceReason: filterResult.relevanceReason,
          confidence: filterResult.confidence,
          suggestedAction: filterResult.suggestedAction,
          eventId: event.id,
          llmModel: model,
          processedAt: new Date().toISOString(),
        };

        await this.markAsProcessedPersistent(event, analysis);
        return analysis;
      }

      // Stage 2: Detailed extraction (expensive, thorough)
      console.log(`Event ${event.id} passed filter, extracting structured data...`);
      const extractResult = await this.extractBrain.execute(provider, model, {
        event,
        contacts,
      });

      // Track cost for the extraction stage
const inputTokens = this.estimateTokens({...event, contacts});
      const outputTokens = this.estimateTokens(extractResult);

      const { cost, withinBudget, alerts } = await llmCostTracker.trackUsage(
        userId,
        model,
        inputTokens,
        outputTokens,
        'calendar_analysis',
        `event_${event.id}`
      );

      // Log cost and budget alerts
      if (cost > 0) {
        console.log(`Event ${event.id} processing cost: $${cost.toFixed(4)}`);
      }

      if (alerts.length > 0) {
        console.warn(`Budget alerts for user ${userId}:`, alerts);
      }

      if (!withinBudget) {
        console.warn(`User ${userId} exceeded budget limits`);
      }

      // Store the processed event
      await this.markAsProcessedPersistent(event, extractResult);
      return extractResult;

    } catch (error) {
      console.error(`Error processing event ${event.id}:`, error);
      throw error;
    }
  }

  /**
   * Estimate token count for cost calculation (rough approximation)
   */
  private estimateTokens(data: unknown): number {
    const text = typeof data === 'string' ? data : JSON.stringify(data);
    // Rough approximation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Mark event as processed in persistent storage
   */
  private async markAsProcessedPersistent(
    event: CalendarEvent,
    analysis: CalendarEventAnalysis
  ): Promise<void> {
    try {
      // Generate a simple hash for the event
      const eventHash = this.generateEventHash({
        summary: event.summary,
        description: event.description,
        attendees: event.attendees,
        startTime: event.startTime,
        endTime: event.endTime,
      });

      if (this.storage?.markEventProcessed) {
        await this.storage.markEventProcessed(
          event.id,
          eventHash,
          analysis.isRelevant || false,
          analysis,
          analysis.llmModel ?? 'unknown'
        );
      }
    } catch (error) {
      console.error('Failed to mark event as processed persistently:', error);
      // Could implement fallback to in-memory storage here if needed
    }
  }

  /**
   * Generate hash for event to detect changes
   */
  private generateEventHash(eventData: {
    summary: string | null;
    description: string | null;
    attendees: unknown;
    startTime: Date | null;
    endTime: Date | null;
  }): string {
    // Create a simple hash from key event properties
    const hashData = JSON.stringify({
      summary: eventData.summary,
      description: eventData.description,
      attendees: eventData.attendees,
      startTime: eventData.startTime?.toISOString(),
      endTime: eventData.endTime?.toISOString(),
    });

    // Simple hash function - in production, consider using crypto.createHash
    let hash = 0;
    for (let i = 0; i < hashData.length; i++) {
      const char = hashData.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }
}
