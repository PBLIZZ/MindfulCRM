/**
 * Utility functions for safe error handling
 */

/**
 * Safely extracts error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error occurred';
}

/**
 * Safely logs error with proper type checking
 */
export function logError(context: string, error: unknown): void {
  console.error(`${context}:`, error);
}

/**
 * Creates a standardized error response object
 */
export function createErrorResponse(message: string, error: unknown, includeDetails = false) {
  const response: { error: string; details?: string } = { error: message };
  
  if (includeDetails && process.env.NODE_ENV === 'development') {
    response.details = getErrorMessage(error);
  }
  
  return response;
}
