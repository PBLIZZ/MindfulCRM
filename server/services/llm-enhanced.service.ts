import { llmConcurrencyController } from '../utils/llm-concurrency-controller.js';
import { llmCostTracker, type BudgetLimits } from '../utils/llm-cost-tracker.js';
import { CalendarFilterBrain } from '../brains/calendar-filter.brain.js';
import { CalendarExtractBrain } from '../brains/calendar-extract.brain.js';
import OpenAI from 'openai';

import { storage } from '../data/index.js';
import type { CalendarEvent } from '../../shared/schema.js';
import type { CalendarEventAnalysis } from '../types/service-contracts.js';
import type { ContactData } from '../types/external-apis.js';

// Import service contracts from centralized location
import type {
  LLMServiceConfig,
  ProcessingMetrics
} from '../types/service-contracts.js';

// Event data interfaces for type safety
interface LLMRequestCompletedData {
  userId: string;
  model: string;
  operation: string;
  success: boolean;
  processingTime: number;
  tokens?: number;
  cost?: number;
}

interface LLMRequestFailedData {
  userId: string;
  model: string;
  operation: string;
  error: string;
  timestamp: number;
}

interface ConcurrencyChangedData {
  newLimit: number;
  currentActive: number;
  timestamp: number;
}

export class EnhancedLLMService {
  private config: LLMServiceConfig;
  private filterBrain: CalendarFilterBrain;
  private extractBrain: CalendarExtractBrain;
  private openRouterClient: OpenAI;
  private metrics: ProcessingMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    avgProcessingTime: 0,
    totalCost: 0,
    concurrencyStats: {
      active: 0,
      queued: 0,
      completed: 0,
      failed: 0,
      avgProcessingTime: 0,
    },
  };

  constructor(config: Partial<LLMServiceConfig> = {}) {
    this.config = {
      defaultConcurrencyLimit: 5,
      defaultBatchSize: 10,
      defaultBatchDelay: 200,
      enableCostTracking: true,
      enablePerformanceMonitoring: true,
      ...config,
    };

    // Initialize brain services for calendar processing
    this.filterBrain = new CalendarFilterBrain();
    this.extractBrain = new CalendarExtractBrain();

    // Initialize OpenRouter client
    this.openRouterClient = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY,
    });

    // Set up cost tracking defaults
    if (this.config.enableCostTracking) {
      this.initializeCostTracking();
    }

    // Set up performance monitoring
    if (this.config.enablePerformanceMonitoring) {
      this.initializePerformanceMonitoring();
    }
  }

  /**
   * Process calendar events with enhanced performance and cost control
   */
  async processCalendarEventsEnhanced(
    events: CalendarEvent[],
    contacts: ContactData[],
    userId: string,
    options: {
      useFreeModel?: boolean;
      priority?: 'high' | 'medium' | 'low';
      maxConcurrency?: number;
      batchSize?: number;
      estimatedTokensPerEvent?: number;
    } = {}
  ): Promise<{
    results: CalendarEventAnalysis[];
    metrics: {
      processed: number;
      successful: number;
      failed: number;
      totalCost: number;
      processingTime: number;
      budgetAlerts: Array<{ type: string; message: string }>;
    };
  }> {
    const startTime = Date.now();
    const {
      useFreeModel = false,
      priority = 'medium',
      maxConcurrency = this.config.defaultConcurrencyLimit,
      batchSize = this.config.defaultBatchSize,
      estimatedTokensPerEvent = 500,
    } = options;

    // Temporarily adjust concurrency if needed
    if (maxConcurrency !== this.config.defaultConcurrencyLimit) {
      llmConcurrencyController.adjustConcurrency(maxConcurrency);
    }

    try {
      // Get cost-optimized model recommendation
      const totalEstimatedTokens = events.length * estimatedTokensPerEvent;
      const costRecommendation = llmCostTracker.getModelRecommendation(
        userId,
        'calendar_analysis',
        totalEstimatedTokens
      );

      const modelToUse = useFreeModel
        ? 'meta-llama/llama-3.1-8b-instruct:free'
        : costRecommendation.recommendedModel;

      console.log(`Enhanced LLM Processing:`);
      console.log(`- Events: ${events.length}`);
      console.log(`- Model: ${modelToUse}`);
      console.log(`- Estimated cost: $${costRecommendation.estimatedCost.toFixed(4)}`);
      console.log(`- Batch size: ${batchSize}, Priority: ${priority}`);

      // Check if user has sufficient budget
      const userStats = llmCostTracker.getCostStats(userId, 'day');
      const budgetAlerts: Array<{ type: string; message: string }> = [];

      if (userStats.budgetUtilization) {
        if (userStats.budgetUtilization.daily > 90) {
          budgetAlerts.push({
            type: 'budget_warning',
            message: 'Daily budget usage is above 90%. Consider using free model.',
          });
        }
        if (userStats.budgetUtilization.monthly > 90) {
          budgetAlerts.push({
            type: 'budget_critical',
            message: 'Monthly budget usage is above 90%. Switching to free model recommended.',
          });
        }
      }

      // Filter events that need processing
      const eventsToProcess = await this.filterEventsForProcessing(events, contacts);
      console.log(`- Filtered to ${eventsToProcess.length} events needing processing`);

      if (eventsToProcess.length === 0) {
        return {
          results: [],
          metrics: {
            processed: 0,
            successful: 0,
            failed: 0,
            totalCost: 0,
            processingTime: Date.now() - startTime,
            budgetAlerts,
          },
        };
      }

      // Create operations for batch processing
      const operations = eventsToProcess.map((event, index) => ({
        operation: () => this.processSingleEventEnhanced(event, contacts, modelToUse, userId),
        userId,
        model: modelToUse,
        priority,
        metadata: { eventId: event.id, batchIndex: index },
      }));

      // Execute with controlled concurrency and cost tracking
      const results = await llmConcurrencyController.executeBatch(operations, {
        batchSize: budgetAlerts.length > 0 ? Math.min(batchSize, 3) : batchSize,
        delayBetweenBatches:
          budgetAlerts.length > 0
            ? this.config.defaultBatchDelay * 2
            : this.config.defaultBatchDelay,
      });

      // Process results and calculate metrics
      const successfulResults: CalendarEventAnalysis[] = [];
      let totalCost = 0;
      let successful = 0;
      let failed = 0;

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const event = eventsToProcess[i];

        if (result.success && result.result) {
          successfulResults.push(result.result);
          successful++;
        } else {
          failed++;
          console.error(`Failed to process event ${event.id}: ${result.error}`);

          // Create default analysis for failed events
          const defaultAnalysis: CalendarEventAnalysis = {
            isRelevant: false,
            relevanceReason: `Processing failed: ${result.error}`,
            eventType: 'unknown',
            isClientRelated: false,
            clientEmails: [],
            sessionType: null,
            keyTopics: [],
            actionItems: [],
            notes: '',
            confidence: 0,
            suggestedAction: 'ignore',
            eventId: event.id,
            processedAt: new Date().toISOString(),
            llmModel: modelToUse,
            skipped: true,
          };

          successfulResults.push(defaultAnalysis);
        }
      }

      // Get updated cost statistics
      const updatedStats = llmCostTracker.getCostStats(userId, 'day');
      totalCost = updatedStats.totalCost - userStats.totalCost;

      const processingTime = Date.now() - startTime;

      // Update service metrics
      this.updateMetrics({
        processed: results.length,
        successful,
        failed,
        totalCost,
        processingTime,
      });

      console.log(`Enhanced LLM Processing completed:`);
      console.log(`- Processed: ${results.length}/${events.length} events`);
      console.log(`- Successful: ${successful}, Failed: ${failed}`);
      console.log(`- Total cost: $${totalCost.toFixed(4)}`);
      console.log(`- Processing time: ${processingTime}ms`);

      return {
        results: successfulResults,
        metrics: {
          processed: results.length,
          successful,
          failed,
          totalCost,
          processingTime,
          budgetAlerts,
        },
      };
    } finally {
      // Restore original concurrency limit
      if (maxConcurrency !== this.config.defaultConcurrencyLimit) {
        llmConcurrencyController.adjustConcurrency(this.config.defaultConcurrencyLimit);
      }
    }
  }

  /**
   * Process a single event with enhanced error handling and cost tracking
   */
  private async processSingleEventEnhanced(
    event: CalendarEvent,
    contacts: ContactData[],
    model: string,
    userId: string
  ): Promise<CalendarEventAnalysis> {
    const startTime = Date.now();

    try {
      // Create provider interface for brains
      const provider = {
        generateCompletion: async (model: string, messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[], isJson: boolean) => {
          const response = await this.openRouterClient.chat.completions.create({
            model,
            messages,
            ...(isJson ? { response_format: { type: 'json_object' } } : {}),
          });
          return response.choices[0]?.message?.content ?? '';
        }
      };

      // Stage 1: Filter for relevance (cheap)
      const filterResult = await this.filterBrain.execute(provider, model, {
        event,
        contacts,
      });

      // If not relevant, return early
      if (!filterResult.isRelevant) {
        const analysis: CalendarEventAnalysis = {
          isRelevant: false,
          relevanceReason: filterResult.relevanceReason,
          eventType: 'unknown',
          isClientRelated: false,
          clientEmails: [],
          sessionType: null,
          keyTopics: [],
          actionItems: [],
          notes: '',
          confidence: filterResult.confidence,
          suggestedAction: filterResult.suggestedAction,
          processedAt: new Date().toISOString(),
          llmModel: model,
          eventId: event.id,
        };
        return analysis;
      }

      // Stage 2: Extract structured data (expensive)
      const analysis = await this.extractBrain.execute(provider, model, {
        event,
        contacts,
      });

      // Estimate and track token usage
      const inputTokens = this.estimateInputTokens(event, contacts);
      const outputTokens = this.estimateOutputTokens(analysis);

      const { cost, withinBudget, alerts } = await llmCostTracker.trackUsage(
        userId,
        model,
        inputTokens,
        outputTokens,
        'calendar_analysis_enhanced',
        `event_${event.id}`
      );

      // Log performance metrics
      const processingTime = Date.now() - startTime;
      if (cost > 0) {
        console.log(
          `Event ${event.id}: $${cost.toFixed(4)}, ${processingTime}ms, ${
            inputTokens + outputTokens
          } tokens`
        );
      }

      // Handle budget alerts
      if (alerts.length > 0) {
        console.warn(
          `Budget alerts for user ${userId}:`,
          alerts.map((a) => a.alertType)
        );
      }

      if (!withinBudget) {
        console.warn(`User ${userId} budget exceeded - consider switching to free model`);
      }

      return {
        ...analysis,
        processedAt: new Date().toISOString(),
        llmModel: model,
        eventId: event.id,
      };
    } catch (error) {
      console.error(`Error processing event ${event.id}:`, error);
      throw error;
    }
  }

  /**
   * Filter events that actually need processing
   */
  private async filterEventsForProcessing(
    events: CalendarEvent[],
    _contacts: ContactData[]
  ): Promise<CalendarEvent[]> {
    const eventsToProcess: CalendarEvent[] = [];

    for (const event of events) {
      // Check if event should be skipped (basic filtering)
      if (this.shouldSkipEventBasicFilter(event)) {
        continue;
      }

      // Check if already processed (if storage is available)
if (storage.shouldProcessEvent && typeof storage.shouldProcessEvent === 'function') {
        try {
          const shouldProcess = await storage.shouldProcessEvent(event.id);
          if (!shouldProcess) {
            continue;
          }
        } catch (error) {
          console.warn(`Could not check processing status for event ${event.id}:`, error);
        }
      }

      eventsToProcess.push(event);
    }

    return eventsToProcess;
  }

  /**
   * Basic event filtering to avoid unnecessary LLM calls
   */
  private shouldSkipEventBasicFilter(event: CalendarEvent): boolean {
    const skipPatterns = [
      /^(birthday|anniversary)/i,
      /^(spam|advertisement|promotion)/i,
      /^(automated|system|notification)/i,
      /^(holiday|vacation|out of office)/i,
      /^(personal|private|lunch|dinner|break)/i,
    ];

    const eventTitle = event.summary ?? '';
    return skipPatterns.some((pattern) => pattern.test(eventTitle));
  }

  /**
   * Estimate input tokens for cost calculation
   */
  private estimateInputTokens(event: CalendarEvent, contacts: ContactData[]): number {
    const eventText = [
      event.summary ?? '',
      event.description ?? '',
      event.location ?? '',
      JSON.stringify(event.attendees ?? []),
    ].join(' ');

    const contactsText = contacts.map((c) => `${c.name} ${c.email}`).join(' ');
    const totalText = `${eventText} ${contactsText}`;

    // Rough approximation: 1 token ≈ 4 characters
    return Math.ceil(totalText.length / 4);
  }

  /**
   * Estimate output tokens for cost calculation
   */
  private estimateOutputTokens(analysis: CalendarEventAnalysis): number {
    const outputText = JSON.stringify(analysis);
    return Math.ceil(outputText.length / 4);
  }

  /**
   * Update service metrics
   */
  private updateMetrics(update: {
    processed: number;
    successful: number;
    failed: number;
    totalCost: number;
    processingTime: number;
  }): void {
    this.metrics.totalRequests += update.processed;
    this.metrics.successfulRequests += update.successful;
    this.metrics.failedRequests += update.failed;
    this.metrics.totalCost += update.totalCost;

    // Update average processing time
    const totalTime =
      this.metrics.avgProcessingTime * (this.metrics.totalRequests - update.processed) +
      update.processingTime;
    this.metrics.avgProcessingTime = totalTime / this.metrics.totalRequests;

    // Update concurrency stats
    this.metrics.concurrencyStats = llmConcurrencyController.getStats();
  }

  /**
   * Get service performance metrics
   */
  getMetrics(): ProcessingMetrics & {
    systemStats: ReturnType<typeof llmCostTracker.getSystemStats>;
    concurrencyStats: ReturnType<typeof llmConcurrencyController.getStats>;
  } {
    return {
      ...this.metrics,
      systemStats: llmCostTracker.getSystemStats(),
      concurrencyStats: llmConcurrencyController.getStats(),
    };
  }

  /**
   * Set budget limits for a user
   */
  setUserBudget(userId: string, limits: Omit<BudgetLimits, 'userId'>): void {
    llmCostTracker.setBudgetLimits(userId, limits);
  }

  /**
   * Get user cost statistics with optimization recommendations
   */
  getUserCostAnalysis(userId: string): {
    stats: ReturnType<typeof llmCostTracker.getCostStats>;
    optimization: ReturnType<typeof llmCostTracker.generateOptimizationReport>;
    recommendations: Array<{
      action: string;
      expectedSaving: number;
      priority: 'high' | 'medium' | 'low';
    }>;
  } {
    const stats = llmCostTracker.getCostStats(userId, 'month');
    const optimization = llmCostTracker.generateOptimizationReport(userId);

    // Generate specific recommendations based on usage patterns
    const recommendations: Array<{
      action: string;
      expectedSaving: number;
      priority: 'high' | 'medium' | 'low';
    }> = [];

    // High-cost operations recommendations
    for (const [operation, data] of Object.entries(stats.operationBreakdown)) {
      if (data.cost > 5 && operation.includes('calendar')) {
        recommendations.push({
          action: `Switch calendar analysis to free model during bulk processing`,
          expectedSaving: data.cost * 0.8,
          priority: 'high',
        });
      }
    }

    // Model optimization recommendations
    const premiumModelCost = stats.modelBreakdown['qwen/qwen3-235b-a22b-2507']?.cost ?? 0;
    if (premiumModelCost > 10) {
      recommendations.push({
        action: 'Use premium model only for critical operations, free model for bulk tasks',
        expectedSaving: premiumModelCost * 0.6,
        priority: 'medium',
      });
    }

    // Budget recommendations
    if (!stats.budgetUtilization) {
      recommendations.push({
        action: 'Set up daily and monthly budget limits to prevent cost overruns',
        expectedSaving: 0,
        priority: 'high',
      });
    }

    return { stats, optimization, recommendations };
  }

  /**
   * Initialize cost tracking with default settings
   */
  private initializeCostTracking(): void {
    // Set up default budget limits for new users
    llmConcurrencyController.on('requestCompleted', (data: LLMRequestCompletedData) => {
      if (this.config.enableCostTracking) {
        // Cost tracking is handled within the enhanced processing methods
        // Log successful completion for monitoring
        if (data.processingTime > 10000) { // Log slow requests
          console.info(`Slow LLM request: ${data.operation} took ${data.processingTime}ms for user ${data.userId}`);
        }
      }
    });
  }

  /**
   * Initialize performance monitoring
   */
  private initializePerformanceMonitoring(): void {
    // Set up performance event listeners
    llmConcurrencyController.on('requestFailed', (data: LLMRequestFailedData) => {
      console.warn(
        `LLM request failed: ${data.error} (Model: ${data.model}, User: ${data.userId})`
      );
    });

    llmConcurrencyController.on('concurrencyChanged', (data: ConcurrencyChangedData) => {
      console.log(`Concurrency limit adjusted to ${data.newLimit} (Active: ${data.currentActive})`);
    });

    // Periodic performance reporting
    setInterval(() => {
      const stats = this.getMetrics();
      if (stats.totalRequests > 0 && stats.totalRequests % 100 === 0) {
        console.log(`LLM Service Performance Report:
          - Total requests: ${stats.totalRequests}
          - Success rate: ${((stats.successfulRequests / stats.totalRequests) * 100).toFixed(1)}%
          - Avg processing time: ${stats.avgProcessingTime.toFixed(0)}ms
          - Total cost: $${stats.totalCost.toFixed(2)}
          - Active/Queued: ${stats.concurrencyStats.active}/${stats.concurrencyStats.queued}`);
      }
    }, 60000); // Report every minute if there's activity
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.log('Enhanced LLM Service shutting down...');
    await llmConcurrencyController.shutdown();
    console.log('Enhanced LLM Service shutdown complete');
  }
}

// Create singleton instance with production-optimized settings
export const enhancedLLMService = new EnhancedLLMService({
  defaultConcurrencyLimit: 5,
  defaultBatchSize: 10,
  defaultBatchDelay: 200,
  enableCostTracking: true,
  enablePerformanceMonitoring: true,
});
