/**
 * LLM Cost Tracking Service
 *
 * Centralized service for tracking LLM usage, costs, and daily limits.
 * Implements the LLMCostTracking interface from service-contracts.ts
 */

import type { LLMCostTracking, LLMUsageStats } from '../types/service-contracts.js';

export class LLMCostService implements LLMCostTracking {
  private static instance: LLMCostService;
  private dailyUsage = new Map<string, LLMUsageStats>();
  private readonly DAILY_COST_LIMIT = 5.0; // $5 daily limit per user

  static getInstance(): LLMCostService {
    if (!LLMCostService.instance) {
      LLMCostService.instance = new LLMCostService();
    }
    return LLMCostService.instance;
  }

  /**
   * Track LLM usage for a user
   */
  trackUsage(userId: string, tokens: number, model: string): void {
    const today = new Date().toISOString().split('T')[0];
    const key = `${userId}:${today}`;

    const costPerToken = this.getCostPerToken(model);
    const cost = tokens * costPerToken;

    const current = this.dailyUsage.get(key) ?? { requests: 0, tokens: 0, cost: 0 };
    current.requests++;
    current.tokens += tokens;
    current.cost += cost;

    this.dailyUsage.set(key, current);

    // Log warning if daily cost exceeds threshold
    if (current.cost > this.DAILY_COST_LIMIT) {
      console.warn(`⚠️ User ${userId} has exceeded daily LLM cost limit: $${current.cost.toFixed(2)}`);
    }
  }

  /**
   * Get daily usage statistics for a user
   */
  getDailyUsage(userId: string): LLMUsageStats {
    const today = new Date().toISOString().split('T')[0];
    const key = `${userId}:${today}`;
    return this.dailyUsage.get(key) ?? { requests: 0, tokens: 0, cost: 0 };
  }

  /**
   * Check if user has exceeded daily cost limit
   */
  checkDailyLimit(userId: string): boolean {
    const usage = this.getDailyUsage(userId);
    return usage.cost < this.DAILY_COST_LIMIT;
  }

  /**
   * Get cost per token for different models
   */
  private getCostPerToken(model: string): number {
    // Cost estimates per token (these should be updated with actual pricing)
    const modelCosts: Record<string, number> = {
      'meta-llama/llama-3.1-8b-instruct:free': 0, // Free model
      'moonshotai/kimi-k2': 0.0001,
      'openai/gpt-4': 0.00003,
      'openai/gpt-3.5-turbo': 0.000002,
      'anthropic/claude-3-sonnet': 0.000015,
      'anthropic/claude-3-haiku': 0.00000025,
    };

    return modelCosts[model] ?? 0.0001; // Default cost for unknown models
  }

  /**
   * Get usage statistics for all users (admin function)
   */
  getAllUsageStats(): Array<{ userId: string; date: string; stats: LLMUsageStats }> {
    const results: Array<{ userId: string; date: string; stats: LLMUsageStats }> = [];

    for (const [key, stats] of this.dailyUsage.entries()) {
      const [userId, date] = key.split(':');
      results.push({ userId, date, stats });
    }

    return results.sort((a, b) => b.date.localeCompare(a.date));
  }

  /**
   * Reset usage data (for testing or maintenance)
   */
  resetUsageData(): void {
    this.dailyUsage.clear();
    console.log('LLM usage data has been reset');
  }

  /**
   * Clean up old usage data (keep only last 30 days)
   */
  cleanupOldData(): void {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString().split('T')[0];

    let removedCount = 0;
    for (const [key] of this.dailyUsage.entries()) {
      const [, date] = key.split(':');
      if (date < cutoffDate) {
        this.dailyUsage.delete(key);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      console.log(`🧹 Cleaned up ${removedCount} old LLM usage records`);
    }
  }
}

// Export singleton instance
export const llmCostService = LLMCostService.getInstance();
