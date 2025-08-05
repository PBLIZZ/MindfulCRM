interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  modelType: 'free' | 'premium';
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export interface UsageStats {
  freeModelUsage: { count: number; resetTime: number | null };
  premiumModelUsage: { count: number; resetTime: number | null };
  recommendations: string[];
}

export interface ModelRecommendation {
  model: string;
  reason: string;
}

export class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private config: Record<string, RateLimitConfig> = {
    'meta-llama/llama-3.1-8b-instruct:free': {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 20, // 20 requests per minute for free model
      modelType: 'free',
    },
    'qwen/qwen3-235b-a22b-2507': {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 60, // 60 requests per minute for premium model
      modelType: 'premium',
    },
  };

  async checkLimit(
    userId: string,
    model: string
  ): Promise<{ allowed: boolean; resetTime?: number; suggestion?: string }> {
    const config = this.config[model];
    if (!config) {
      return { allowed: true }; // No limit configured for this model
    }

    const key = `${userId}:${model}`;
    const now = Date.now();
    const entry = this.limits.get(key);

    // Clean up expired entries
    if (entry && now > entry.resetTime) {
      this.limits.delete(key);
    }

    const currentEntry = this.limits.get(key);

    if (!currentEntry) {
      // First request in window
      this.limits.set(key, {
        count: 1,
        resetTime: now + config.windowMs,
      });
      return { allowed: true };
    }

    if (currentEntry.count >= config.maxRequests) {
      // Rate limit exceeded
      const suggestion =
        config.modelType === 'premium'
          ? 'Consider using the free model for bulk processing or wait for rate limit reset'
          : 'Consider upgrading to premium model for higher rate limits';

      return {
        allowed: false,
        resetTime: currentEntry.resetTime,
        suggestion,
      };
    }

    // Increment count
    currentEntry.count++;
    return { allowed: true };
  }

  getRecommendedModel(requestCount: number, isHistoricalSync: boolean = false): ModelRecommendation {
    // For historical sync or large batches, recommend free model
    if (isHistoricalSync || requestCount > 50) {
      return {
        model: 'meta-llama/llama-3.1-8b-instruct:free',
        reason: `Historical sync or large batch (${requestCount} requests) - using free model to avoid rate limits`
      };
    }

    // For ongoing processing or small batches, use premium model
    return {
      model: 'qwen/qwen3-235b-a22b-2507',
      reason: `Small batch (${requestCount} requests) - using premium model for better accuracy`
    };
  }

  async getUsageStats(userId: string): Promise<UsageStats> {
    const freeKey = `${userId}:meta-llama/llama-3.1-8b-instruct:free`;
    const premiumKey = `${userId}:qwen/qwen3-235b-a22b-2507`;

    const freeEntry = this.limits.get(freeKey);
    const premiumEntry = this.limits.get(premiumKey);

    const recommendations = [];

    // Generate recommendations based on usage
    if (premiumEntry && premiumEntry.count > 40) {
      recommendations.push('Consider using free model for bulk operations to save costs');
    }

    if (freeEntry && freeEntry.count > 15) {
      recommendations.push('Free model usage is high - premium model offers better accuracy');
    }

    if (!freeEntry && !premiumEntry) {
      recommendations.push('Start with free model for testing, upgrade to premium for production');
    }

    return {
      freeModelUsage: {
        count: freeEntry?.count ?? 0,
        resetTime: freeEntry?.resetTime ?? null,
      },
      premiumModelUsage: {
        count: premiumEntry?.count ?? 0,
        resetTime: premiumEntry?.resetTime ?? null,
      },
      recommendations,
    };
  }

  // Clean up expired entries periodically
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.limits.entries()) {
      if (now > entry.resetTime) {
        this.limits.delete(key);
      }
    }
  }
}

export const rateLimiter = new RateLimiter();

// Clean up expired entries every 5 minutes
setInterval(() => {
  rateLimiter.cleanup();
}, 5 * 60 * 1000);
