interface ModelPricing {
  inputTokenCost: number;  // Cost per 1000 input tokens
  outputTokenCost: number; // Cost per 1000 output tokens
  currency: 'USD';
}

interface UsageRecord {
  userId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  requestId: string;
  timestamp: Date;
  operation: string; // e.g., 'calendar_analysis', 'photo_enrichment', 'task_analysis'
}

interface CostAlert {
  userId: string;
  alertType: 'daily_limit' | 'monthly_limit' | 'unusual_usage';
  threshold: number;
  currentValue: number;
  timestamp: Date;
}

interface BudgetLimits {
  dailyLimit: number;
  monthlyLimit: number;
  userId: string;
  alertThreshold: number; // Percentage (e.g., 80 = alert at 80% of limit)
}

export class LLMCostTracker {
  private readonly MODEL_PRICING: Record<string, ModelPricing> = {
    'meta-llama/llama-3.1-8b-instruct:free': {
      inputTokenCost: 0, // Free model
      outputTokenCost: 0,
      currency: 'USD'
    },
    'qwen/qwen3-235b-a22b-2507': {
      inputTokenCost: 0.15, // Per 1000 tokens - estimate
      outputTokenCost: 0.30,
      currency: 'USD'
    },
    'moonshotai/kimi-k2': {
      inputTokenCost: 0.20, // Per 1000 tokens - estimate
      outputTokenCost: 0.40,
      currency: 'USD'
    }
  };

  private usageRecords: UsageRecord[] = [];
  private budgetLimits: Map<string, BudgetLimits> = new Map();
  private costAlerts: CostAlert[] = [];

  /**
   * Track LLM usage and calculate costs
   */
  async trackUsage(
    userId: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
    operation: string,
    requestId?: string
  ): Promise<{ cost: number; withinBudget: boolean; alerts: CostAlert[] }> {
    const pricing = this.MODEL_PRICING[model];
    if (!pricing) {
      console.warn(`No pricing information for model: ${model}`);
      return { cost: 0, withinBudget: true, alerts: [] };
    }

    // Calculate cost
    const inputCost = (inputTokens / 1000) * pricing.inputTokenCost;
    const outputCost = (outputTokens / 1000) * pricing.outputTokenCost;
    const totalCost = inputCost + outputCost;

    // Record usage
    const usageRecord: UsageRecord = {
      userId,
      model,
      inputTokens,
      outputTokens,
      cost: totalCost,
      requestId: requestId ?? `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      operation
    };

    this.usageRecords.push(usageRecord);

    // Trim old records to prevent memory issues (keep last 10,000)
    if (this.usageRecords.length > 10000) {
      this.usageRecords = this.usageRecords.slice(-10000);
    }

    // Check budget limits and generate alerts
    const alerts = await this.checkBudgetLimits(userId, totalCost);
    const withinBudget = alerts.length === 0;

    return { cost: totalCost, withinBudget, alerts };
  }

  /**
   * Set budget limits for a user
   */
  setBudgetLimits(userId: string, limits: Omit<BudgetLimits, 'userId'>): void {
    this.budgetLimits.set(userId, { ...limits, userId });
  }

  /**
   * Get cost statistics for a user
   */
  getCostStats(
    userId: string,
    timeframe: 'day' | 'week' | 'month' | 'all' = 'month'
  ): {
    totalCost: number;
    totalRequests: number;
    avgCostPerRequest: number;
    modelBreakdown: Record<string, { cost: number; requests: number; tokens: number }>;
    operationBreakdown: Record<string, { cost: number; requests: number }>;
    dailyTrend: Array<{ date: string; cost: number; requests: number }>;
    budgetUtilization?: { daily: number; monthly: number };
  } {
    const now = new Date();
    let startDate: Date;

    switch (timeframe) {
      case 'day':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(0);
    }

    const userRecords = this.usageRecords.filter(
      record => record.userId === userId && record.timestamp >= startDate
    );

    // Calculate totals
    const totalCost = userRecords.reduce((sum, record) => sum + record.cost, 0);
    const totalRequests = userRecords.length;
    const avgCostPerRequest = totalRequests > 0 ? totalCost / totalRequests : 0;

    // Model breakdown
    const modelBreakdown: Record<string, { cost: number; requests: number; tokens: number }> = {};
    for (const record of userRecords) {
      if (!modelBreakdown[record.model]) {
        modelBreakdown[record.model] = { cost: 0, requests: 0, tokens: 0 };
      }
      modelBreakdown[record.model].cost += record.cost;
      modelBreakdown[record.model].requests += 1;
      modelBreakdown[record.model].tokens += record.inputTokens + record.outputTokens;
    }

    // Operation breakdown
    const operationBreakdown: Record<string, { cost: number; requests: number }> = {};
    for (const record of userRecords) {
      if (!operationBreakdown[record.operation]) {
        operationBreakdown[record.operation] = { cost: 0, requests: 0 };
      }
      operationBreakdown[record.operation].cost += record.cost;
      operationBreakdown[record.operation].requests += 1;
    }

    // Daily trend (last 30 days)
    const dailyTrend: Array<{ date: string; cost: number; requests: number }> = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      const dayRecords = userRecords.filter(
        record => record.timestamp.toISOString().split('T')[0] === dateStr
      );
      
      dailyTrend.push({
        date: dateStr,
        cost: dayRecords.reduce((sum, record) => sum + record.cost, 0),
        requests: dayRecords.length
      });
    }

    // Budget utilization
    let budgetUtilization: { daily: number; monthly: number } | undefined;
    const budgetLimits = this.budgetLimits.get(userId);
    if (budgetLimits) {
      const todayCost = this.getDailyCost(userId, now);
      const monthlyCost = this.getMonthlyCost(userId, now);
      
      budgetUtilization = {
        daily: budgetLimits.dailyLimit > 0 ? (todayCost / budgetLimits.dailyLimit) * 100 : 0,
        monthly: budgetLimits.monthlyLimit > 0 ? (monthlyCost / budgetLimits.monthlyLimit) * 100 : 0
      };
    }

    return {
      totalCost,
      totalRequests,
      avgCostPerRequest,
      modelBreakdown,
      operationBreakdown,
      dailyTrend,
      budgetUtilization
    };
  }

  /**
   * Get cost-optimized model recommendation
   */
  getModelRecommendation(
    userId: string,
    operation: string,
    estimatedTokens: number
  ): {
    recommendedModel: string;
    estimatedCost: number;
    reason: string;
    alternatives: Array<{ model: string; cost: number; reason: string }>;
  } {
    const userStats = this.getCostStats(userId, 'month');
    const alternatives: Array<{ model: string; cost: number; reason: string }> = [];

    // Calculate estimated costs for each model
    for (const [model, pricing] of Object.entries(this.MODEL_PRICING)) {
      const estimatedCost = (estimatedTokens / 1000) * (pricing.inputTokenCost + pricing.outputTokenCost);
      let reason = '';

      if (model.includes('free')) {
        reason = 'Free tier - good for bulk operations';
      } else if (model.includes('qwen')) {
        reason = 'Premium model - better accuracy';
      } else if (model.includes('kimi')) {
        reason = 'High-capability model - best for complex analysis';
      }

      alternatives.push({ model, cost: estimatedCost, reason });
    }

    // Sort by cost
    alternatives.sort((a, b) => a.cost - b.cost);

    // Recommendation logic
    let recommendedModel = alternatives[0].model; // Default to cheapest
    let reason = 'Cost-optimized choice';

    // Check if user is approaching budget limits
    if (userStats.budgetUtilization) {
      if (userStats.budgetUtilization.daily > 80 || userStats.budgetUtilization.monthly > 80) {
        recommendedModel = alternatives.find(alt => alt.cost === 0)?.model ?? alternatives[0].model;
        reason = 'Budget limit approaching - using free model';
      } else if (operation === 'calendar_analysis' && userStats.budgetUtilization.monthly < 50) {
        // For calendar analysis with sufficient budget, use premium model
        recommendedModel = alternatives.find(alt => alt.model.includes('qwen'))?.model ?? alternatives[0].model;
        reason = 'Premium model for better calendar analysis accuracy';
      }
    }

    const estimatedCost = alternatives.find(alt => alt.model === recommendedModel)?.cost ?? 0;

    return {
      recommendedModel,
      estimatedCost,
      reason,
      alternatives
    };
  }

  /**
   * Generate cost optimization report
   */
  generateOptimizationReport(userId: string): {
    currentMonthSpend: number;
    projectedMonthSpend: number;
    potentialSavings: number;
    recommendations: string[];
    topCostDrivers: Array<{ operation: string; cost: number; percentage: number }>;
  } {
    const stats = this.getCostStats(userId, 'month');
    const dailyAverage = stats.dailyTrend.reduce((sum, day) => sum + day.cost, 0) / 30;
    const projectedMonthSpend = dailyAverage * 30;

    // Identify potential savings
    let potentialSavings = 0;
    const recommendations: string[] = [];

    // Check if using premium models for operations that could use free models
    for (const [operation, data] of Object.entries(stats.operationBreakdown)) {
      if (operation === 'bulk_operations' && data.cost > 0) {
        potentialSavings += data.cost * 0.8; // 80% savings by using free model
        recommendations.push(`Use free model for ${operation} to save ~$${(data.cost * 0.8).toFixed(2)}`);
      }
    }

    // Top cost drivers
    const topCostDrivers = Object.entries(stats.operationBreakdown)
      .map(([operation, data]) => ({
        operation,
        cost: data.cost,
        percentage: (data.cost / stats.totalCost) * 100
      }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 5);

    // General recommendations
    if (stats.totalCost > 10) {
      recommendations.push('Consider setting daily and monthly budget limits');
    }
    
    if (stats.modelBreakdown['meta-llama/llama-3.1-8b-instruct:free']?.requests === 0) {
      recommendations.push('Try free models for non-critical operations to reduce costs');
    }

    return {
      currentMonthSpend: stats.totalCost,
      projectedMonthSpend,
      potentialSavings,
      recommendations,
      topCostDrivers
    };
  }

  private async checkBudgetLimits(userId: string, newCost: number): Promise<CostAlert[]> {
    const budgetLimits = this.budgetLimits.get(userId);
    if (!budgetLimits) return [];

    const alerts: CostAlert[] = [];
    const now = new Date();

    // Check daily limit
    const todayCost = this.getDailyCost(userId, now) + newCost;
    if (todayCost >= budgetLimits.dailyLimit * (budgetLimits.alertThreshold / 100)) {
      alerts.push({
        userId,
        alertType: 'daily_limit',
        threshold: budgetLimits.dailyLimit,
        currentValue: todayCost,
        timestamp: now
      });
    }

    // Check monthly limit
    const monthlyCost = this.getMonthlyCost(userId, now) + newCost;
    if (monthlyCost >= budgetLimits.monthlyLimit * (budgetLimits.alertThreshold / 100)) {
      alerts.push({
        userId,
        alertType: 'monthly_limit',
        threshold: budgetLimits.monthlyLimit,
        currentValue: monthlyCost,
        timestamp: now
      });
    }

    // Store alerts
    this.costAlerts.push(...alerts);

    return alerts;
  }

  private getDailyCost(userId: string, date: Date): number {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return this.usageRecords
      .filter(record => 
        record.userId === userId && 
        record.timestamp >= startOfDay && 
        record.timestamp <= endOfDay
      )
      .reduce((sum, record) => sum + record.cost, 0);
  }

  private getMonthlyCost(userId: string, date: Date): number {
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

    return this.usageRecords
      .filter(record => 
        record.userId === userId && 
        record.timestamp >= startOfMonth && 
        record.timestamp <= endOfMonth
      )
      .reduce((sum, record) => sum + record.cost, 0);
  }

  /**
   * Export usage data for analysis
   */
  exportUsageData(userId: string, startDate?: Date, endDate?: Date): UsageRecord[] {
    let records = this.usageRecords.filter(record => record.userId === userId);

    if (startDate) {
      records = records.filter(record => record.timestamp >= startDate);
    }

    if (endDate) {
      records = records.filter(record => record.timestamp <= endDate);
    }

    return records;
  }

  /**
   * Get system-wide cost statistics (admin function)
   */
  getSystemStats(): {
    totalUsers: number;
    totalCost: number;
    totalRequests: number;
    topUsers: Array<{ userId: string; cost: number; requests: number }>;
    topModels: Array<{ model: string; cost: number; requests: number }>;
  } {
    const userStats = new Map<string, { cost: number; requests: number }>();
    const modelStats = new Map<string, { cost: number; requests: number }>();

    for (const record of this.usageRecords) {
      // User stats
      if (!userStats.has(record.userId)) {
        userStats.set(record.userId, { cost: 0, requests: 0 });
      }
      const userStat = userStats.get(record.userId)!;
      userStat.cost += record.cost;
      userStat.requests += 1;

      // Model stats
      if (!modelStats.has(record.model)) {
        modelStats.set(record.model, { cost: 0, requests: 0 });
      }
      const modelStat = modelStats.get(record.model)!;
      modelStat.cost += record.cost;
      modelStat.requests += 1;
    }

    return {
      totalUsers: userStats.size,
      totalCost: this.usageRecords.reduce((sum, record) => sum + record.cost, 0),
      totalRequests: this.usageRecords.length,
      topUsers: Array.from(userStats.entries())
        .map(([userId, stats]) => ({ userId, ...stats }))
        .sort((a, b) => b.cost - a.cost)
        .slice(0, 10),
      topModels: Array.from(modelStats.entries())
        .map(([model, stats]) => ({ model, ...stats }))
        .sort((a, b) => b.cost - a.cost)
    };
  }
}

// Global singleton instance
export const llmCostTracker = new LLMCostTracker();

// Export types
export type { UsageRecord, CostAlert, BudgetLimits };