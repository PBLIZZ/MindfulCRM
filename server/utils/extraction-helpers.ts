/**
 * Shared extraction utilities
 * Used across all LLM-based structured data extraction
 */

/**
 * Safely extracts JSON from LLM responses by removing markdown and finding JSON boundaries
 */
export function extractJSON(content: string): string {
  // Remove common markdown code blocks
  content = content
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .trim();

  // Find the first opening brace and last closing brace
  const firstBrace = content.indexOf('{');
  const lastBrace = content.lastIndexOf('}');

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return content.substring(firstBrace, lastBrace + 1);
  }

  // If no braces found, return the content as-is and let JSON.parse handle the error
  return content;
}

/**
 * Validates and filters array of strings from LLM responses
 */
export function validateStringArray(data: unknown): string[] {
  return Array.isArray(data)
    ? data.filter((item): item is string => typeof item === 'string')
    : [];
}

/**
 * Validates string field from LLM response with fallback
 */
export function validateString(data: unknown, fallback: string = ''): string {
  return typeof data === 'string' ? data : fallback;
}

/**
 * Validates boolean field from LLM response with fallback
 */
export function validateBoolean(data: unknown, fallback: boolean = false): boolean {
  return typeof data === 'boolean' ? data : fallback;
}

/**
 * Validates number field from LLM response with fallback and bounds
 */
export function validateNumber(
  data: unknown,
  fallback: number = 0,
  min?: number,
  max?: number
): number {
  let num = typeof data === 'number' ? data : fallback;
  if (min !== undefined) num = Math.max(num, min);
  if (max !== undefined) num = Math.min(num, max);
  return num;
}

/**
 * Creates a standardized error response for failed extractions
 */
export function createErrorResponse<T>(
  defaultResponse: T,
  error: unknown,
  context: string
): T {
  console.error(`${context} extraction failed:`, error);
  return defaultResponse;
}

/**
 * Estimates token count for cost calculation (rough approximation)
 */
export function estimateTokens(data: unknown): number {
  const text = typeof data === 'string' ? data : JSON.stringify(data);
  // Rough approximation: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
}

/**
 * Generate simple hash for event change detection
 * Extracted from legacy calendar processing logic
 */
export function generateEventHash(eventData: {
  summary: string | null;
  description: string | null;
  attendees: unknown;
  startTime: Date | null;
  endTime: Date | null;
}): string {
  // Create a simple hash from key event properties
  const hashData = JSON.stringify({
    summary: eventData.summary,
    description: eventData.description,
    attendees: eventData.attendees,
    startTime: eventData.startTime?.toISOString(),
    endTime: eventData.endTime?.toISOString(),
  });

  // Simple hash function - in production, consider using crypto.createHash
  let hash = 0;
  for (let i = 0; i < hashData.length; i++) {
    const char = hashData.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString();
}

/**
 * Check if event has changed by comparing hashes
 */
export function hasEventChanged(
  event: { summary: string | null; description: string | null; attendees: unknown; startTime: Date | null; endTime: Date | null },
  processedEventHash: string
): boolean {
  const currentHash = generateEventHash(event);
  return currentHash !== processedEventHash;
}
