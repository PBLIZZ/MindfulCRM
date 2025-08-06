import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import type { CalendarEvent } from '../../shared/schema.js';
import type { ContactData } from '../types/external-apis.js';
import { sanitizeForLLM } from '../utils/sanitizers.js';
import {
  isNoReplyEmail,
  isSpamContent,
  isPersonalContent,
  hasBusinessRelevance,
  extractEmailsFromAttendees
} from '../utils/relevance-patterns.js';
import { extractJSON, validateBoolean, validateString, createErrorResponse } from '../utils/extraction-helpers.js';

// Generic interface for LLM provider
interface LLMProvider {
  generateCompletion(
    model: string,
    messages: ChatCompletionMessageParam[],
    isJson: boolean
  ): Promise<string>;
}

export type CalendarFilterInput = {
  event: CalendarEvent;
  contacts: ContactData[];
};

export type CalendarFilterOutput = {
  isRelevant: boolean;
  relevanceReason: string;
  confidence: number;
  suggestedAction: 'process' | 'ignore' | 'review';
};

export class CalendarFilterBrain {
  /**
   * Pre-filter events before LLM processing to save costs
   */
  private preFilter(input: CalendarFilterInput): CalendarFilterOutput | null {
    const { event, contacts } = input;
    const knownContactEmails = new Set(contacts.map(c => c.email.toLowerCase()));

    // Get valid attendee emails
const attendeeEmails = Array.isArray(event.attendees) ? extractEmailsFromAttendees(event.attendees) : [];
    const hasKnownContacts = attendeeEmails.some(email => knownContactEmails.has(email));

    // Check title and description content
    const title = event.summary ?? '';
    const description = event.description ?? '';
    const combinedContent = `${title} ${description}`.toLowerCase();

    // Auto-reject spam content
    if (isSpamContent(combinedContent)) {
      return {
        isRelevant: false,
        relevanceReason: 'Filtered out as spam/promotional content',
        confidence: 0.9,
        suggestedAction: 'ignore'
      };
    }

    // Auto-reject personal content with no known contacts
    if (isPersonalContent(combinedContent) && !hasKnownContacts) {
      return {
        isRelevant: false,
        relevanceReason: 'Personal event with no known contacts',
        confidence: 0.85,
        suggestedAction: 'ignore'
      };
    }

    // Auto-reject if all attendees are no-reply emails
    if (attendeeEmails.length > 0 && attendeeEmails.every(email => isNoReplyEmail(email))) {
      return {
        isRelevant: false,
        relevanceReason: 'All attendees are no-reply addresses',
        confidence: 0.95,
        suggestedAction: 'ignore'
      };
    }

    // Auto-accept if has business relevance AND known contacts
    if (hasBusinessRelevance(combinedContent) && hasKnownContacts) {
      return {
        isRelevant: true,
        relevanceReason: 'Business-relevant event with known contacts',
        confidence: 0.8,
        suggestedAction: 'process'
      };
    }

    // Needs LLM analysis
    return null;
  }

  private buildMessages(input: CalendarFilterInput): ChatCompletionMessageParam[] {
    const { event, contacts } = input;
    const knownContactEmails = new Set(contacts.map(c => c.email.toLowerCase()));
const attendeeEmails = Array.isArray(event.attendees) ? extractEmailsFromAttendees(event.attendees) : [];
    const hasKnownContacts = attendeeEmails.some(email => knownContactEmails.has(email));

    // Sanitize event data
    const sanitizedTitle = sanitizeForLLM(event.summary ?? 'No title');
    const sanitizedDescription = sanitizeForLLM(event.description ?? 'No description');
    const sanitizedLocation = sanitizeForLLM(event.location ?? 'No location');
    const sanitizedMeetingType = sanitizeForLLM(event.meetingType ?? 'Unknown');

    const prompt = `
Analyze this calendar event for a wellness/coaching CRM to determine relevance for professional practice.

EVENT DETAILS:
- Title: ${sanitizedTitle}
- Description: ${sanitizedDescription}
- Start: ${event.startTime?.toISOString() ?? 'Unknown'}
- End: ${event.endTime?.toISOString() ?? 'Unknown'}
- Location: ${sanitizedLocation}
- Meeting Type: ${sanitizedMeetingType}
- Has Known Client Contacts: ${hasKnownContacts}
- Attendee Count: ${attendeeEmails.length}

FILTERING CRITERIA:
MARK AS RELEVANT if the event is:
- A client session (therapy, coaching, wellness, consultation)
- A business meeting related to the practice
- Professional development or training
- Administrative work for the practice

MARK AS NOT RELEVANT if the event is:
- Personal appointments (doctor, dentist, personal errands)
- Social events unrelated to business
- Automated calendar entries (birthdays, holidays)
- Spam or marketing events
- Events with no clear business purpose

BE CONSERVATIVE: When in doubt, mark as NOT relevant to save processing costs.

Return JSON:
{
  "isRelevant": boolean,
  "relevanceReason": "brief explanation",
  "confidence": 0.0-1.0,
  "suggestedAction": "process" | "ignore" | "review"
}`;

    return [
      {
        role: 'system',
        content: 'You are a cost-conscious filter for a wellness coaching CRM. Your job is to quickly identify which calendar events are worth deeper analysis. Be conservative - when uncertain, mark as not relevant to save costs.',
      },
      { role: 'user', content: prompt },
    ];
  }

  async execute(
    provider: LLMProvider,
    model: string,
    input: CalendarFilterInput
  ): Promise<CalendarFilterOutput> {
    try {
      // Try pre-filtering first to save LLM costs
      const preFilterResult = this.preFilter(input);
      if (preFilterResult) {
        return preFilterResult;
      }

      // Use LLM for ambiguous cases
      const messages = this.buildMessages(input);
      const rawResponse = await provider.generateCompletion(model, messages, true);
      const content = extractJSON(rawResponse);
      const result = JSON.parse(content) as Partial<CalendarFilterOutput>;

      return {
        isRelevant: validateBoolean(result.isRelevant, false),
        relevanceReason: validateString(result.relevanceReason, 'No reason provided'),
        confidence: typeof result.confidence === 'number' ?
          Math.max(0, Math.min(1, result.confidence)) : 0.5,
        suggestedAction: ['process', 'ignore', 'review'].includes(result.suggestedAction as string) ?
          result.suggestedAction as 'process' | 'ignore' | 'review' : 'review'
      };

    } catch (error) {
      return createErrorResponse(
        {
          isRelevant: false,
          relevanceReason: 'Processing error occurred',
          confidence: 0.0,
          suggestedAction: 'review' as const
        },
        error,
        `Calendar filter brain for event ${input.event.id}`
      );
    }
  }
}
