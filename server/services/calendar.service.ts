import { storage } from '../data/index.js';
import { syncService } from './sync.js';
import { googleService } from '../providers/google.provider.js';
import { CalendarBatchOrchestrationBrain } from '../brains/calendar-batch-orchestration.brain.js';
import { openRouterService as _openRouterService } from '../providers/openrouter.provider.js';
import OpenAI from 'openai';
import { rateLimiter, type UsageStats } from '../utils/rate-limiter.js';
import { safeAnalysisData } from '../utils/api-helpers.js';
import type { User, CalendarEvent, Contact as _Contact } from '../../shared/schema.js';
import type { StorageInterface } from '../types/service-contracts.js';

// Types for LLM provider interface
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface LLMProvider {
  generateCompletion(model: string, messages: ChatMessage[], isJson: boolean): Promise<string>;
}

interface BatchResult {
  eventId?: string;
  [key: string]: unknown;
}

// Initialize services that depend on storage modules at the top level
const calendarBatchBrain = new CalendarBatchOrchestrationBrain(storage as unknown as StorageInterface);

// Initialize OpenRouter client for brain processing
const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

export class CalendarService {
  async getCalendarEvents(userId: string, month?: string): Promise<CalendarEvent[]> {
    const allEvents = await storage.calendar.getByUserId(userId);
    if (month) {
      const targetDate = new Date(month);
      const targetYear = targetDate.getFullYear();
      const targetMonth = targetDate.getMonth();
      return allEvents.filter((event) => {
        if (!event.startTime) return false;
        const eventDate = new Date(event.startTime);
        return eventDate.getFullYear() === targetYear && eventDate.getMonth() === targetMonth;
      });
    }
    return allEvents;
  }

  async getUpcomingEvents(userId: string, limit: number): Promise<CalendarEvent[]> {
    const allEvents = await storage.calendar.getByUserId(userId, 200); // Fetch more to ensure we get enough future events
    const now = new Date();
    return allEvents
      .filter((event) => event.startTime && new Date(event.startTime) > now)
      .sort((a, b) => new Date(a.startTime!).getTime() - new Date(b.startTime!).getTime())
      .slice(0, limit);
  }

  async runInitialSync(
    user: User,
    months: number,
    useFreeModel: boolean
  ): Promise<{
    totalEvents: number;
    relevantEvents: number;
    monthsProcessed: number;
  }> {
    const now = new Date();
    const startDate = new Date(now.getTime() - months * 30 * 24 * 60 * 60 * 1000);
    const endDate = new Date(now.getTime() + 6 * 30 * 24 * 60 * 60 * 1000); // 6 months forward

    await googleService.syncCalendar(user, { startDate, endDate, syncType: 'initial' });

    const contacts = await storage.contacts.getByUserId(user.id);
    const events = await storage.calendar.getUnprocessed(user.id);

    let processedCount = 0;
    const batchSize = 25;
    for (let i = 0; i < events.length; i += batchSize) {
      const batch = events.slice(i, i + batchSize);
      // Create provider interface
      const provider: LLMProvider = {
        generateCompletion: async (model: string, messages: ChatMessage[], isJson: boolean) => {
          const response = await openrouter.chat.completions.create({
            model,
            messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
            ...(isJson ? { response_format: { type: 'json_object' } } : {}),
          });
          return response.choices[0]?.message?.content ?? '';
        }
      };

      const batchResult = await calendarBatchBrain.execute(provider, {
        events: batch,
        contacts,
        userId: user.id,
        useFreeModel
      });
      const results = batchResult.successfulResults;
      processedCount += results.length;

      for (const event of batch) {
        const extractedData = safeAnalysisData(results.find((r) => r.eventId === event.id));
        await storage.calendar.update(event.id, { processed: true, extractedData });
      }
    }

    return {
      totalEvents: events.length,
      relevantEvents: processedCount,
      monthsProcessed: months,
    };
  }

  async runOngoingSync(user: User): Promise<{
    newEvents: number;
    relevantEvents: number;
    usageStats: UsageStats;
  }> {
    await syncService.syncCalendar(user.id);

    const contacts = await storage.contacts.getByUserId(user.id);
    const unprocessedEvents = await storage.calendar.getUnprocessed(user.id);

    let results: BatchResult[] = [];
    if (unprocessedEvents.length > 0) {
      // Create provider interface
      const provider: LLMProvider = {
        generateCompletion: async (model: string, messages: ChatMessage[], isJson: boolean) => {
          const response = await openrouter.chat.completions.create({
            model,
            messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
            ...(isJson ? { response_format: { type: 'json_object' } } : {}),
          });
          return response.choices[0]?.message?.content ?? '';
        }
      };

      // For ongoing sync, use premium model for better accuracy
      const batchResult = await calendarBatchBrain.execute(provider, {
        events: unprocessedEvents,
        contacts,
        userId: user.id,
        useFreeModel: false
      });
      results = batchResult.successfulResults;
      for (const event of unprocessedEvents) {
        const extractedData = results.find((r) => r.eventId === event.id) ?? {};
        await storage.calendar.update(event.id, { processed: true, extractedData });
      }
    }

    const usageStats = await rateLimiter.getUsageStats(user.id);

    return {
      newEvents: unprocessedEvents.length,
      relevantEvents: results.length,
      usageStats,
    };
  }

  async getSyncStats(userId: string): Promise<{
    totalEvents: number;
    processedEvents: number;
    unprocessedEvents: number;
    oldestEvent: Date | null;
    newestEvent: Date | null;
  }> {
    const allEvents = await storage.calendar.getByUserId(userId, 1000); // Cap at 1000 for stats perf
    const unprocessedEvents = await storage.calendar.getUnprocessed(userId);

    return {
      totalEvents: allEvents.length,
      processedEvents: allEvents.length - unprocessedEvents.length,
      unprocessedEvents: unprocessedEvents.length,
      oldestEvent: allEvents.length > 0 ? allEvents[allEvents.length - 1]?.startTime : null,
      newestEvent: allEvents.length > 0 ? allEvents[0]?.startTime : null,
    };
  }

  async getUnprocessedCount(userId: string): Promise<{ count: number }> {
    const events = await storage.calendar.getUnprocessed(userId);
    return { count: events.length };
  }
}

export const calendarService = new CalendarService();
