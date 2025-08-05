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
type NullToUndefined<T> = T extends null ? undefined : T extends Record<string, unknown> ? { [K in keyof T]: NullToUndefined<T[K]> } : T;

export function nullsToUndefined<T>(obj: T): NullToUndefined<T> {
  if (obj === null || obj === undefined) {
    return undefined as NullToUndefined<T>;
  }
  if (typeof obj !== 'object') {
    return obj as NullToUndefined<T>;
  }
  if (Array.isArray(obj)) {
    return obj.map(nullsToUndefined) as NullToUndefined<T>;
  }
  const newObj = {} as Record<string, unknown>;
  for (const key in obj) {
    if (obj[key] === null) {
      newObj[key] = undefined;
    } else {
      newObj[key] = nullsToUndefined(obj[key]);
    }
  }
  return newObj as NullToUndefined<T>;
}

/**
 * Helper function to safely handle CalendarEventAnalysis results
 * that might be null and convert them to proper Record<string, unknown>
 */
export function safeAnalysisData(analysis: unknown): Record<string, unknown> {
  if (analysis === null || analysis === undefined) {
    return {};
  }
  return analysis as Record<string, unknown>;
}