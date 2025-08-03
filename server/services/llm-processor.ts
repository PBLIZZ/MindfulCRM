import { storage } from '../storage.js';
import type { User } from '../../shared/schema.js';
import { createOpenRouterService } from './openrouter.js';
import OpenAI from 'openai';

const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

export class LLMProcessor {
  /**
   * Process unprocessed calendar events for a user
   * Extracts client sessions, appointments, and insights
   */
  async processCalendarEvents(user: User): Promise<void> {
    try {
      console.log(`Starting LLM processing for user ${user.email}`);

      // Create OpenRouter service instance
      const openRouterService = createOpenRouterService(storage);

      const unprocessedEvents = await storage.getUnprocessedCalendarEvents(user.id);
      console.log(`Found ${unprocessedEvents.length} unprocessed calendar events`);

      if (unprocessedEvents.length === 0) {
        return;
      }

      // Get all user contacts for matching
      const contacts = await storage.getContactsByUserId(user.id);

      for (const event of unprocessedEvents) {
        try {
          const extractedData = await openRouterService.analyzeCalendarEvent(event, contacts);

          // Update the event with extracted data and mark as processed
          await storage.markCalendarEventProcessed(event.id, extractedData);

          console.log(`Processed event: ${event.summary} - Type: ${extractedData.eventType}`);
        } catch (error) {
          console.error(`Error processing event ${event.id}:`, error);
          // Mark as processed with error to avoid reprocessing
          await storage.markCalendarEventProcessed(event.id, {
            error: error instanceof Error ? error.message : 'Unknown error',
            eventType: 'unknown',
          });
        }
      }

      console.log(`Completed LLM processing for user ${user.email}`);
    } catch (error) {
      console.error('LLM processing error:', error);
    }
  }

  /**
   * Process text using Kimi 2 model for advanced reasoning
   */
  async processWithKimi(prompt: string): Promise<string> {
    try {
      const response = await openrouter.chat.completions.create({
        model: 'moonshotai/kimi-k2',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful AI assistant. Provide accurate and detailed responses.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.1,
        max_tokens: 2000,
      });

      return response.choices[0]?.message?.content ?? '';
    } catch (error) {
      console.error('Kimi processing error:', error);
      throw error;
    }
  }

  /**
   * Process text prompt using OpenRouter
   */
  async processPrompt(prompt: string, _userId: string): Promise<string> {
    try {
      const response = await openrouter.chat.completions.create({
        model: 'meta-llama/llama-3.1-8b-instruct:free',
        messages: [
          {
            role: 'system',
            content:
              'You are a helpful AI assistant for a wellness CRM system. Provide accurate and structured responses.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 1500,
      });

      return response.choices[0]?.message?.content ?? '';
    } catch (error) {
      console.error('LLM prompt processing error:', error);
      throw error;
    }
  }

  /**
   * Process all users' calendar events (for background job)
   */
  async processAllUsers(): Promise<void> {
    try {
      console.log('Background LLM processing started for all users');

      // Get all users from the database
      const { db } = await import('../db.js');
      const { users } = await import('../../shared/schema.js');
      const allUsers = await db.select().from(users);

      for (const user of allUsers) {
        await this.processCalendarEvents(user);
      }

      console.log('Background LLM processing completed');
    } catch (error) {
      console.error('Background LLM processing error:', error);
    }
  }
}

export const llmProcessor = new LLMProcessor();
