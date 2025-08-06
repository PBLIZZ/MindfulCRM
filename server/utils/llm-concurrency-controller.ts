import { EventEmitter } from 'events';
import type {
  QueuedRequest,
  ConcurrencyStats,
  LLMRequestPriority,
  LLMBatchOptions
} from '../types/service-contracts.js';

export class LLMConcurrencyController extends EventEmitter {
  private activeRequests = new Map<string, QueuedRequest<unknown>>();
  private requestQueue: QueuedRequest<unknown>[] = [];
  private maxConcurrentRequests: number;
  private processingTimes: number[] = [];
  private stats: ConcurrencyStats = {
    active: 0,
    queued: 0,
    completed: 0,
    failed: 0,
    avgProcessingTime: 0,
  };

  constructor(maxConcurrentRequests: number = 5) {
    super();
    this.maxConcurrentRequests = maxConcurrentRequests;
    void this.processQueue();
  }

  /**
   * Execute LLM operation with concurrency control
   */
  async execute<T>(
    operation: () => Promise<T>,
    options: {
      userId: string;
      model: string;
      priority?: LLMRequestPriority;
      timeout?: number;
    }
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const request: QueuedRequest<T> = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        operation,
        resolve,
        reject,
        priority: options.priority ?? 'medium',
        timestamp: Date.now(),
        userId: options.userId,
        model: options.model,
      };

      // Add timeout handling
      if (options.timeout) {
        setTimeout(() => {
          this.removeFromQueue(request.id);
          reject(new Error(`LLM request timeout after ${options.timeout}ms`));
        }, options.timeout);
      }

      this.addToQueue(request);
    });
  }

  /**
   * Execute multiple operations with controlled concurrency
   */
  async executeBatch<T>(
    operations: Array<{
      operation: () => Promise<T>;
      userId: string;
      model: string;
      priority?: LLMRequestPriority;
    }>,
    options: LLMBatchOptions = {}
  ): Promise<Array<{ success: boolean; result?: T; error?: string }>> {
    const { batchSize = 10, delayBetweenBatches = 100 } = options;
    const results: Array<{ success: boolean; result?: T; error?: string }> = [];

    // Process in smaller batches to avoid overwhelming the system
    for (let i = 0; i < operations.length; i += batchSize) {
      const batch = operations.slice(i, i + batchSize);

      // Execute batch with Promise.allSettled to handle failures gracefully
      const batchPromises = batch.map(op =>
        this.execute(op.operation, {
          userId: op.userId,
          model: op.model,
          priority: op.priority,
          timeout: 60000, // 60 second timeout per operation
        })
      );

      const batchResults = await Promise.allSettled(batchPromises);

      // Process results
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push({ success: true, result: result.value });
        } else {
          results.push({
            success: false,
            error: result.reason instanceof Error ? result.reason.message : 'Unknown error'
          });
        }
      }

      // Add delay between batches to respect rate limits
      if (i + batchSize < operations.length && delayBetweenBatches > 0) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
      }
    }

    return results;
  }

  /**
   * Get current system statistics
   */
  getStats(): ConcurrencyStats & {
    queueDepth: number;
    modelBreakdown: Record<string, number>;
    userBreakdown: Record<string, number>;
  } {
    const modelBreakdown: Record<string, number> = {};
    const userBreakdown: Record<string, number> = {};

    // Count active requests by model and user
    this.activeRequests.forEach(request => {
      modelBreakdown[request.model] = (modelBreakdown[request.model] ?? 0) + 1;
      userBreakdown[request.userId] = (userBreakdown[request.userId] ?? 0) + 1;
    });

    // Count queued requests
    for (const request of this.requestQueue) {
      modelBreakdown[request.model] = (modelBreakdown[request.model] ?? 0) + 1;
      userBreakdown[request.userId] = (userBreakdown[request.userId] ?? 0) + 1;
    }

    return {
      ...this.stats,
      active: this.activeRequests.size,
      queued: this.requestQueue.length,
      queueDepth: this.requestQueue.length,
      modelBreakdown,
      userBreakdown,
    };
  }

  /**
   * Dynamically adjust concurrency based on system performance
   */
  adjustConcurrency(newLimit: number): void {
    if (newLimit < 1 || newLimit > 50) {
      throw new Error('Concurrency limit must be between 1 and 50');
    }

    this.maxConcurrentRequests = newLimit;
    this.emit('concurrencyChanged', { newLimit, currentActive: this.activeRequests.size });

    // Process queue if we increased the limit
    if (newLimit > this.activeRequests.size) {
      void this.processQueue();
    }
  }

  private addToQueue<T>(request: QueuedRequest<T>): void {
    // Insert based on priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const insertIndex = this.requestQueue.findIndex(
      r => priorityOrder[r.priority] > priorityOrder[request.priority]
    );

    // Cast to unknown to satisfy type constraints
    const unknownRequest = request as QueuedRequest<unknown>;

    if (insertIndex === -1) {
      this.requestQueue.push(unknownRequest);
    } else {
      this.requestQueue.splice(insertIndex, 0, unknownRequest);
    }

    this.stats.queued = this.requestQueue.length;
    this.emit('requestQueued', { id: request.id, queueLength: this.requestQueue.length });
  }

  private removeFromQueue(requestId: string): boolean {
    const index = this.requestQueue.findIndex(r => r.id === requestId);
    if (index !== -1) {
      this.requestQueue.splice(index, 1);
      this.stats.queued = this.requestQueue.length;
      return true;
    }
    return false;
  }

  private async processQueue(): Promise<void> {
    while (this.activeRequests.size < this.maxConcurrentRequests && this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      if (!request) break;

      this.activeRequests.set(request.id, request);
      this.stats.active = this.activeRequests.size;
      this.stats.queued = this.requestQueue.length;

      // Process request asynchronously
      this.processRequest(request).catch(error => {
        console.error(`Error processing LLM request ${request.id}:`, error);
      });
    }

    // Auto-process queue periodically
    setTimeout(() => this.processQueue(), 100);
  }

  private async processRequest<T>(request: QueuedRequest<T>): Promise<void> {
    const startTime = Date.now();

    try {
      this.emit('requestStarted', { id: request.id, model: request.model, userId: request.userId });

      const result = await request.operation();
      const processingTime = Date.now() - startTime;

      // Update processing time statistics
      this.processingTimes.push(processingTime);
      if (this.processingTimes.length > 100) {
        this.processingTimes.shift(); // Keep only last 100 times
      }
      this.stats.avgProcessingTime = this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length;

      this.stats.completed++;
      request.resolve(result);

      this.emit('requestCompleted', {
        id: request.id,
        processingTime,
        model: request.model,
        userId: request.userId
      });

    } catch (error) {
      this.stats.failed++;
      request.reject(error);

      this.emit('requestFailed', {
        id: request.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        model: request.model,
        userId: request.userId
      });
    } finally {
      this.activeRequests.delete(request.id);
      this.stats.active = this.activeRequests.size;

      // Continue processing queue
      setTimeout(() => this.processQueue(), 0);
    }
  }

  /**
   * Gracefully shutdown and wait for active requests to complete
   */
  async shutdown(timeoutMs: number = 30000): Promise<void> {
    const shutdownPromise = new Promise<void>((resolve) => {
      const checkActive = () => {
        if (this.activeRequests.size === 0) {
          resolve();
        } else {
          setTimeout(checkActive, 100);
        }
      };
      checkActive();
    });

    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => reject(new Error('Shutdown timeout')), timeoutMs);
    });

    try {
      await Promise.race([shutdownPromise, timeoutPromise]);
    } catch {
      console.warn('LLM Concurrency Controller shutdown timeout, forcing shutdown');
      // Reject all pending requests
      this.activeRequests.forEach(request => {
        request.reject(new Error('System shutdown'));
      });
      this.requestQueue.forEach(request => {
        request.reject(new Error('System shutdown'));
      });
    }
  }
}

// Global singleton instance
export const llmConcurrencyController = new LLMConcurrencyController(5);

// Re-export types from service-contracts for convenience
export type { ConcurrencyStats, QueuedRequest, LLMRequestPriority, LLMBatchOptions } from '../types/service-contracts.js';
