/**
 * Shared relevance filtering patterns and utilities
 * Used across calendar, email, task, and note filtering
 */

export const NO_REPLY_PATTERNS = [
  /no-?reply/i,
  /do-?not-?reply/i,
  /notifications?@/i,
  /automated@/i,
  /system@/i,
  /mailer-daemon/i,
  /postmaster@/i,
];

export const SPAM_PATTERNS = [
  /^(spam|advertisement|promotion)/i,
  /^(automated|system|notification)/i,
  /unsubscribe/i,
  /marketing@/i,
  /newsletter/i,
];

export const PERSONAL_PATTERNS = [
  /^(birthday|anniversary)/i,
  /^(holiday|vacation|out of office)/i,
  /^(lunch|dinner|break|personal|private)/i,
  /^(doctor|dentist|medical|appointment)/i,
];

export const BUSINESS_RELEVANCE_PATTERNS = [
  // Client session indicators
  /session|appointment|consultation|therapy|coaching/i,
  /client|patient|wellness|treatment/i,

  // Business meeting indicators
  /meeting|conference|call|zoom|teams/i,
  /business|work|professional|training/i,

  // Administrative indicators
  /admin|planning|review|follow.?up/i,
];

export function isNoReplyEmail(email: string): boolean {
  return NO_REPLY_PATTERNS.some(pattern => pattern.test(email));
}

export function isSpamContent(content: string): boolean {
  return SPAM_PATTERNS.some(pattern => pattern.test(content));
}

export function isPersonalContent(content: string): boolean {
  return PERSONAL_PATTERNS.some(pattern => pattern.test(content));
}

export function hasBusinessRelevance(content: string): boolean {
  return BUSINESS_RELEVANCE_PATTERNS.some(pattern => pattern.test(content));
}

export function extractEmailsFromAttendees(attendees: unknown[]): string[] {
  return attendees
    .filter((a): a is { email: string } =>
      a !== null &&
      typeof a === 'object' &&
      'email' in a &&
      typeof (a as { email: unknown }).email === 'string'
    )
    .map(a => a.email.toLowerCase())
    .filter(email => !isNoReplyEmail(email));
}
