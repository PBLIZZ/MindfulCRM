/**
 * Utility functions to sanitize user input for LLM processing
 * to prevent prompt injection attacks
 */

export function sanitizeForLLM(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Remove control characters and non-printable characters
  // eslint-disable-next-line no-control-regex
  let sanitized = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Remove potential prompt hijacking patterns
  const dangerousPatterns = [
    // Common prompt injection patterns
    /ignore\s+previous\s+instructions/gi,
    /forget\s+everything\s+above/gi,
    /system\s*:/gi,
    /assistant\s*:/gi,
    /human\s*:/gi,
    /user\s*:/gi,
    /ai\s*:/gi,
    /\[system\]/gi,
    /\[assistant\]/gi,
    /\[user\]/gi,
    /\[human\]/gi,
    /<\|system\|>/gi,
    /<\|assistant\|>/gi,
    /<\|user\|>/gi,
    /<\|human\|>/gi,
    /```[^`]*system[^`]*```/gi,
    /```[^`]*assistant[^`]*```/gi,
    // Markdown code blocks that could contain instructions
    /```\s*(?:system|assistant|human|user)\s*\n/gi,
    // Role-play hijacking attempts
    /pretend\s+you\s+are/gi,
    /act\s+as\s+if/gi,
    /roleplay\s+as/gi,
    /you\s+are\s+now/gi,
    // Common jailbreak attempts
    /jailbreak/gi,
    /DAN\s*mode/gi,
    /developer\s+mode/gi,
    // XML-like tags that could be interpreted as instructions
    /<instruction[^>]*>/gi,
    /<\/instruction>/gi,
    /<prompt[^>]*>/gi,
    /<\/prompt>/gi,
  ];

  // Remove dangerous patterns
  for (const pattern of dangerousPatterns) {
    sanitized = sanitized.replace(pattern, '[FILTERED]');
  }

  // Remove excessive markdown formatting that could hide instructions
  sanitized = sanitized.replace(/#{4,}/g, '###'); // Limit header levels
  sanitized = sanitized.replace(/\*{3,}/g, '**'); // Limit bold formatting
  sanitized = sanitized.replace(/_{3,}/g, '__'); // Limit italic formatting

  // Remove potential code injection in markdown
  sanitized = sanitized.replace(/```[\s\S]*?```/g, '[CODE_BLOCK_REMOVED]');
  sanitized = sanitized.replace(/`[^`]*`/g, '[INLINE_CODE_REMOVED]');

  // Remove HTML tags that could contain instructions
  sanitized = sanitized.replace(/<script[\s\S]*?<\/script>/gi, '[SCRIPT_REMOVED]');
  sanitized = sanitized.replace(/<[^>]*>/g, '');

  // Limit length to prevent buffer overflow attacks
  if (sanitized.length > 10000) {
    sanitized = sanitized.substring(0, 10000) + '[TRUNCATED]';
  }

  // Remove excessive whitespace
  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  return sanitized;
}

/**
 * Sanitize contact names and personal information for LLM processing
 */
export function sanitizeContactInfo(info: string): string {
  const sanitized = sanitizeForLLM(info);

  // Additional sanitization for contact info
  // Remove potential phone numbers that could be instructions
  return sanitized.replace(/\+?1?\s*\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g, '[PHONE_NUMBER]');
}

/**
 * Sanitize email content for LLM processing
 */
export function sanitizeEmailContent(content: string): string {
  const sanitized = sanitizeForLLM(content);

  // Remove email addresses that could contain instructions
  return sanitized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_ADDRESS]');
}

/**
 * Sanitize response data by removing sensitive fields and cleaning text content
 */
export function sanitizeResponse<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }

  if (Array.isArray(data)) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return data.map(item => sanitizeResponse(item)) as T;
  }

  if (typeof data === 'object') {
    const sanitized = { ...data } as Record<string, unknown>;

    // Remove sensitive fields that should never be exposed in API responses
    const sensitiveFields = ['password', 'passwordHash', 'secret', 'token', 'privateKey', 'apiKey'];
    for (const field of sensitiveFields) {
      if (field in sanitized) {
        delete sanitized[field];
      }
    }

    // Recursively sanitize nested objects
    for (const [key, value] of Object.entries(sanitized)) {
      if (typeof value === 'string') {
        sanitized[key] = sanitizeForLLM(value);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeResponse(value);
      }
    }

    return sanitized as T;
  }

  return data;
}
