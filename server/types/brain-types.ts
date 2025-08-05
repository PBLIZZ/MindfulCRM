/**
 * Common types for brain interfaces and outputs
 * Provides type aliases for compatibility with existing code
 */

import type { InsightBrainOutput } from '../brains/generate-insights.brain.js';

// Type alias for backward compatibility
export type ContactInsights = InsightBrainOutput;

// Additional common brain types can be added here as needed
export interface BrainExecutionResult<T> {
  success: boolean;
  result?: T;
  error?: string;
  processingTimeMs?: number;
}

export interface BrainExecutionContext {
  userId: string;
  model: string;
  priority: 'low' | 'medium' | 'high';
  timeout?: number;
}