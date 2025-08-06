/**
 * Advanced rate limiting utilities with fallback models and exponential backoff
 * Extracted from legacy calendar processing logic
 */

import { rateLimiter } from './rate-limiter.js';

export interface RateLimitResult {
  allowed: boolean;
  resetTime?: number;
  suggestion?: string;
}

export interface RateLimitStrategy {
  primaryModel: string;
  fallbackModel?: string;
  maxWaitTime?: number;
  enableExponentialBackoff?: boolean;
}

export class AdvancedRateLimiter {
  private rateLimitDelayMs = 0;
  private backoffAttempts = new Map<string, number>();

  /**
   * Handle rate limiting with model fallback and exponential backoff
   */
  async handleRateLimit(
    userId: string,
    strategy: RateLimitStrategy
  ): Promise<{
    model: string;
    shouldProceed: boolean;
    waitTime?: number;
  }> {
    const { primaryModel, fallbackModel, maxWaitTime = 60000 } = strategy;

    // Check primary model rate limit
    const primaryCheck = await rateLimiter.checkLimit(userId, primaryModel);

    if (primaryCheck.allowed) {
      return {
        model: primaryModel,
        shouldProceed: true,
      };
    }

    const waitTime = primaryCheck.resetTime ? primaryCheck.resetTime - Date.now() : maxWaitTime;

    console.log(
      `Rate limit exceeded for ${primaryModel}. ${primaryCheck.suggestion}. Wait time: ${waitTime}ms`
    );

    // Try fallback model if available
    if (fallbackModel && !primaryModel.includes('free')) {
      console.log(`Attempting fallback to ${fallbackModel}`);

      const fallbackCheck = await rateLimiter.checkLimit(userId, fallbackModel);
      if (fallbackCheck.allowed) {
        console.log(`Successfully switched to fallback model: ${fallbackModel}`);
        return {
          model: fallbackModel,
          shouldProceed: true,
        };
      }
    }

    // If no fallback available or fallback also rate limited, decide whether to wait
    const shouldWait = waitTime <= maxWaitTime;

    if (shouldWait) {
      console.log(`Waiting ${waitTime}ms for rate limit reset`);
      await this.sleep(waitTime);
      this.rateLimitDelayMs += waitTime;

      return {
        model: primaryModel,
        shouldProceed: true,
        waitTime,
      };
    }

    return {
      model: primaryModel,
      shouldProceed: false,
      waitTime,
    };
  }

  /**
   * Handle rate limit errors with exponential backoff
   */
  async handleRateLimitError(
    error: Error,
    context: string,
    maxBackoffTime: number = 30000
  ): Promise<number> {
    const errorMessage = error.message;

    if (errorMessage.includes('rate') || errorMessage.includes('429')) {
      const attempts = this.backoffAttempts.get(context) ?? 0;
      const backoffTime = Math.min(1000 * Math.pow(2, attempts % 5), maxBackoffTime);

      console.log(`Rate limit error detected for ${context}, backing off for ${backoffTime}ms`);

      await this.sleep(backoffTime);
      this.rateLimitDelayMs += backoffTime;
      this.backoffAttempts.set(context, attempts + 1);

      return backoffTime;
    }

    return 0;
  }

  /**
   * Add respectful delay between requests
   */
  async addRespectfulDelay(delayMs: number = 100): Promise<void> {
    await this.sleep(delayMs);
  }

  /**
   * Get total rate limit delay accumulated
   */
  getTotalDelayMs(): number {
    return this.rateLimitDelayMs;
  }

  /**
   * Reset delay tracking
   */
  resetDelayTracking(): void {
    this.rateLimitDelayMs = 0;
    this.backoffAttempts.clear();
  }

  /**
   * Log rate limit delay summary
   */
  logDelaySummary(): void {
    if (this.rateLimitDelayMs > 0) {
      console.log(`Total processing time included ${this.rateLimitDelayMs}ms of rate limit delays`);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Common rate limiting strategies for different use cases
 */
export const RATE_LIMIT_STRATEGIES = {
  CALENDAR_ANALYSIS: {
    primaryModel: 'qwen/qwen3-235b-a22b-2507',
    fallbackModel: 'meta-llama/llama-3.1-8b-instruct:free',
    maxWaitTime: 60000,
    enableExponentialBackoff: true,
  },
  INSIGHTS_GENERATION: {
    primaryModel: 'moonshotai/kimi-k2',
    fallbackModel: 'meta-llama/llama-3.1-8b-instruct:free',
    maxWaitTime: 30000,
    enableExponentialBackoff: true,
  },
  QUICK_FILTERING: {
    primaryModel: 'meta-llama/llama-3.1-8b-instruct:free',
    maxWaitTime: 15000,
    enableExponentialBackoff: false,
  },
} as const;
