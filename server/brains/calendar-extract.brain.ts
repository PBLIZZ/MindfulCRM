import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import type { CalendarEvent } from '../../shared/schema.js';
import type { ContactData } from '../types/external-apis.js';
import type { CalendarEventAnalysis } from '../types/service-contracts.js';
import { sanitizeForLLM } from '../utils/sanitizers.js';
import { extractEmailsFromAttendees } from '../utils/relevance-patterns.js';
import { 
  extractJSON, 
  validateString, 
  validateBoolean, 
  validateStringArray, 
  validateNumber,
  createErrorResponse 
} from '../utils/extraction-helpers.js';

// Generic interface for LLM provider
interface LLMProvider {
  generateCompletion(
    model: string,
    messages: ChatCompletionMessageParam[],
    isJson: boolean
  ): Promise<string>;
}

export type CalendarExtractInput = {
  event: CalendarEvent;
  contacts: ContactData[];
};

export type CalendarExtractOutput = CalendarEventAnalysis;

export class CalendarExtractBrain {
  private buildMessages(input: CalendarExtractInput): ChatCompletionMessageParam[] {
    const { event, contacts } = input;
    const knownContactEmails = new Set(contacts.map(c => c.email.toLowerCase()));
    const attendeeEmails = Array.isArray(event.attendees) ? extractEmailsFromAttendees(event.attendees) : [];
    
    // Find which attendees are known contacts
    const clientEmails = attendeeEmails.filter(email => knownContactEmails.has(email));
    const hasKnownContacts = clientEmails.length > 0;

    // Sanitize event data
    const sanitizedTitle = sanitizeForLLM(event.summary ?? 'No title');
    const sanitizedDescription = sanitizeForLLM(event.description ?? 'No description');
    const sanitizedLocation = sanitizeForLLM(event.location ?? 'No location');
    const sanitizedMeetingType = sanitizeForLLM(event.meetingType ?? 'Unknown');

    const prompt = `
Extract structured data from this relevant calendar event for a wellness/coaching CRM.

EVENT DETAILS:
- Title: ${sanitizedTitle}
- Description: ${sanitizedDescription}
- Start: ${event.startTime?.toISOString() ?? 'Unknown'}
- End: ${event.endTime?.toISOString() ?? 'Unknown'}
- Location: ${sanitizedLocation}
- Meeting Type: ${sanitizedMeetingType}
- Known Client Emails: ${clientEmails.join(', ') || 'None'}
- Has Known Contacts: ${hasKnownContacts}
- Total Attendees: ${attendeeEmails.length}

EXTRACTION REQUIREMENTS:
Analyze this event and extract structured information focusing on:

1. EVENT CLASSIFICATION:
   - Determine the specific type of professional event
   - Identify if it's client-related and what kind of session
   - Assess the business relevance and context

2. CLIENT RELATIONSHIP:
   - Identify which attendees are known clients
   - Determine the nature of client interaction
   - Note any relationship indicators

3. CONTENT ANALYSIS:
   - Extract key topics discussed or planned
   - Identify action items or follow-ups
   - Note important details for client records

4. BUSINESS INTELLIGENCE:
   - Assess the significance for practice management
   - Identify patterns or insights for client care
   - Note any scheduling or workflow implications

Return detailed JSON:
{
  "eventType": "client_session" | "consultation" | "group_session" | "admin" | "training" | "business_meeting" | "other",
  "isClientRelated": boolean,
  "clientEmails": ["list", "of", "known", "client", "emails"],
  "sessionType": "therapy" | "coaching" | "wellness" | "consultation" | "group" | "intake" | "follow_up" | "other" | null,
  "keyTopics": ["extracted", "key", "topics", "from", "content"],
  "actionItems": ["specific", "action", "items", "or", "follow", "ups"],
  "notes": "Professional summary of the event content and significance for client records",
  "confidence": 0.0-1.0,
  "businessSignificance": "high" | "medium" | "low",
  "clientStage": "new" | "active" | "follow_up" | "maintenance" | "unknown",
  "schedulingNotes": "Any important scheduling or timing considerations"
}

IMPORTANT:
- Only include content that's actually present in the event data
- Be specific and professional in extraction
- Focus on information relevant to wellness/coaching practice
- Leave arrays empty if no relevant information is found
- Provide confidence score based on data clarity`;

    return [
      {
        role: 'system',
        content: 'You are a professional data extraction specialist for wellness and coaching practices. Extract structured, actionable information from calendar events that will help practitioners manage client relationships and optimize their practice. Be thorough but only extract information that is clearly present in the data.',
      },
      { role: 'user', content: prompt },
    ];
  }

  async execute(
    provider: LLMProvider,
    model: string,
    input: CalendarExtractInput
  ): Promise<CalendarExtractOutput> {
    try {
      const messages = this.buildMessages(input);
      const rawResponse = await provider.generateCompletion(model, messages, true);
      const content = extractJSON(rawResponse);
      const result = JSON.parse(content) as Partial<CalendarEventAnalysis>;

      // Validate and structure the response
      const extractedData: CalendarEventAnalysis = {
        isRelevant: true, // Already filtered as relevant by filter brain
        relevanceReason: 'Passed relevance filter and processed for extraction',
        eventType: ['client_session', 'consultation', 'group_session', 'admin', 'training', 'personal', 'spam', 'unknown'].includes(result.eventType as string) ?
          result.eventType as CalendarEventAnalysis['eventType'] : 'unknown',
        isClientRelated: validateBoolean(result.isClientRelated, false),
        clientEmails: validateStringArray(result.clientEmails),
        sessionType: ['therapy', 'coaching', 'wellness', 'consultation', 'group', 'intake', 'follow_up', 'other'].includes(result.sessionType as string) ?
          result.sessionType as CalendarEventAnalysis['sessionType'] : null,
        keyTopics: validateStringArray(result.keyTopics),
        actionItems: validateStringArray(result.actionItems),
        notes: validateString(result.notes, ''),
        confidence: validateNumber(result.confidence, 0.5, 0, 1),
        suggestedAction: 'process' as const,
        
        // Additional fields from extraction
        businessSignificance: ['high', 'medium', 'low'].includes(result.businessSignificance as string) ?
          result.businessSignificance as 'high' | 'medium' | 'low' : 'medium',
        clientStage: ['new', 'active', 'follow_up', 'maintenance', 'unknown'].includes(result.clientStage as string) ?
          result.clientStage as 'new' | 'active' | 'follow_up' | 'maintenance' | 'unknown' : 'unknown',
        schedulingNotes: validateString(result.schedulingNotes, ''),
        
        // Metadata
        processedAt: new Date().toISOString(),
        llmModel: model,
        eventId: input.event.id,
      };

      return extractedData;

    } catch (error) {
      return createErrorResponse(
        {
          isRelevant: false,
          relevanceReason: 'Extraction failed due to processing error',
          eventType: 'unknown' as const,
          isClientRelated: false,
          clientEmails: [],
          sessionType: null,
          keyTopics: [],
          actionItems: [],
          notes: 'Failed to extract structured data',
          confidence: 0.0,
          suggestedAction: 'review' as const,
          processedAt: new Date().toISOString(),
          llmModel: model,
          eventId: input.event.id,
        } as CalendarEventAnalysis,
        error,
        `Calendar extract brain for event ${input.event.id}`
      );
    }
  }
}