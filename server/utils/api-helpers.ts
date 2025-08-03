/**
 * API Helper Functions
 * 
 * Contains utilities for handling API responses and data transformation
 * according to the MindfulCRM Data Doctrine.
 */

/**
 * Converts null values to undefined in an object recursively.
 * This implements the null/undefined conversion rule from the Data Doctrine:
 * - Backend (server) uses null (from database)
 * - Frontend (client) uses undefined (for React/JavaScript conventions)
 * - Conversion happens at the API boundary
 */
export function nullsToUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return undefined as any;
  }
  if (typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(nullsToUndefined) as any;
  }
  const newObj = {} as T;
  for (const key in obj) {
    if (obj[key] === null) {
      newObj[key] = undefined as any;
    } else {
      newObj[key] = nullsToUndefined(obj[key]);
    }
  }
  return newObj;
}

/**
 * Helper function to safely handle CalendarEventAnalysis results
 * that might be null and convert them to proper Record<string, unknown>
 */
export function safeAnalysisData(analysis: any): Record<string, unknown> {
  if (analysis === null || analysis === undefined) {
    return {};
  }
  return analysis as Record<string, unknown>;
}