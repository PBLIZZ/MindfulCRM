import dotenv from 'dotenv';
dotenv.config();

import OpenAI from 'openai';
import { rateLimiter } from './rate-limiter';

// Using OpenAI SDK but pointing to OpenRouter's API endpoint
const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

// Utility function to safely extract JSON from LLM responses
function extractJSON(content: string): string {
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

interface ProcessedEvent {
  eventId: string;
  processedAt: Date;
  originalSummary?: string;
  originalDescription?: string;
  originalAttendees?: any[];
  updatedAt?: Date;
  analysis: any;
}

interface CalendarEventAnalysis {
  isRelevant: boolean;
  relevanceReason: string;
  eventType: 'client_session' | 'consultation' | 'group_session' | 'admin' | 'training' | 'personal' | 'spam' | 'unknown';
  isClientRelated: boolean;
  clientEmails: string[];
  sessionType: 'therapy' | 'coaching' | 'wellness' | 'consultation' | 'group' | 'other' | null;
  keyTopics: string[];
  actionItems: string[];
  notes: string;
  confidence: number;
  suggestedAction: 'process' | 'ignore' | 'review';
}

export class OpenRouterService {
  private processedEvents: Map<string, ProcessedEvent> = new Map();
  private storage: any; // Will be injected

  constructor(storage?: any) {
    this.storage = storage;
  }

  private isNoReplyEmail(email: string): boolean {
    const noReplyPatterns = [
      /no-?reply/i,
      /do-?not-?reply/i,
      /notifications?@/i,
      /automated@/i,
      /system@/i,
      /mailer-daemon/i,
      /postmaster@/i,
    ];
    return noReplyPatterns.some(pattern => pattern.test(email));
  }

  private shouldSkipEvent(event: any, contacts: any[]): boolean {
    const skipPatterns = [
      /^(birthday|anniversary)/i,
      /^(spam|advertisement|promotion)/i,
      /^(automated|system|notification)/i,
      /^(holiday|vacation|out of office)/i,
    ];

    // Check title
    if (event.summary && skipPatterns.some(p => p.test(event.summary))) {
      return true;
    }

    // Check if all attendees are no-reply
    if (event.attendees?.length > 0) {
      const allNoReply = event.attendees.every((a: any) => 
        this.isNoReplyEmail(a.email)
      );
      if (allNoReply) return true;
    }

    // Skip if no attendees and title suggests personal event
    const personalPatterns = /^(lunch|dinner|break|personal|private)/i;
    if (!event.attendees?.length && personalPatterns.test(event.summary || '')) {
      return true;
    }

    return false;
  }

  private hasEventChanged(event: any, processed: ProcessedEvent): boolean {
    return (
      event.updatedAt > processed.processedAt ||
      event.summary !== processed.originalSummary ||
      event.description !== processed.originalDescription ||
      JSON.stringify(event.attendees) !== JSON.stringify(processed.originalAttendees)
    );
  }

  private markAsProcessed(event: any, analysis: any) {
    this.processedEvents.set(event.id, {
      eventId: event.id,
      processedAt: new Date(),
      originalSummary: event.summary,
      originalDescription: event.description,
      originalAttendees: event.attendees,
      updatedAt: event.updatedAt,
      analysis: analysis
    });
  }

  async processCalendarEvents(events: any[], contacts: any[], userId: string, useFreeModel: boolean = false): Promise<any[]> {
    const results = [];
    let rateLimitDelayMs = 0;
    
    // Get recommended model based on batch size
    const recommendedModel = rateLimiter.getRecommendedModel(events.length, useFreeModel);
    const modelToUse = useFreeModel ? 'meta-llama/llama-3.1-8b-instruct:free' : recommendedModel;
    
    console.log(`Processing ${events.length} events with model: ${modelToUse}`);
    
    for (const event of events) {
      // Check if already processed using persistent storage
      if (this.storage) {
        const shouldProcess = await this.storage.shouldProcessEvent(event.id);
        if (!shouldProcess) {
          console.log(`Event ${event.id} already processed and unchanged, skipping...`);
          continue;
        }
      } else {
        // Fallback to in-memory check
        const existingProcess = this.processedEvents.get(event.id);
        if (existingProcess && !this.hasEventChanged(event, existingProcess)) {
          console.log(`Event ${event.id} already processed, skipping...`);
          continue;
        }
      }
      
      // Pre-filter before sending to LLM
      if (this.shouldSkipEvent(event, contacts)) {
        console.log(`Event ${event.id} filtered out by pre-check`);
        await this.markAsProcessedPersistent(event, { isRelevant: false, skipped: true });
        continue;
      }
      
      // Check rate limit before making API call
      const rateLimitCheck = await rateLimiter.checkLimit(userId, modelToUse);
      if (!rateLimitCheck.allowed) {
        const waitTime = rateLimitCheck.resetTime ? rateLimitCheck.resetTime - Date.now() : 60000;
        console.log(`Rate limit exceeded for ${modelToUse}. ${rateLimitCheck.suggestion}. Waiting ${waitTime}ms...`);
        
        // Wait for rate limit reset or switch to free model
        if (modelToUse.includes('qwen') && !useFreeModel) {
          console.log('Switching to free model due to rate limit');
          const freeModelCheck = await rateLimiter.checkLimit(userId, 'meta-llama/llama-3.1-8b-instruct:free');
          if (freeModelCheck.allowed) {
            // Continue with free model
            const analysis = await this.analyzeCalendarEvent(event, contacts, true);
            if (analysis.isRelevant) {
              results.push(analysis);
              await this.markAsProcessedPersistent(event, analysis);
            } else {
              await this.markAsProcessedPersistent(event, { isRelevant: false });
            }
            continue;
          }
        }
        
        // If we can't switch models, wait for reset
        await new Promise(resolve => setTimeout(resolve, Math.min(waitTime, 60000)));
        rateLimitDelayMs += Math.min(waitTime, 60000);
      }
      
      try {
        const analysis = await this.analyzeCalendarEvent(event, contacts, modelToUse.includes('free'));
        
        // Only store and process relevant events
        if (analysis.isRelevant) {
          results.push(analysis);
          await this.markAsProcessedPersistent(event, analysis);
        } else {
          console.log(`Event ${event.id} marked as not relevant: ${analysis.relevanceReason}`);
          await this.markAsProcessedPersistent(event, { isRelevant: false });
        }
        
        // Add small delay between requests to be respectful
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`Error processing event ${event.id}:`, error);
        
        // If it's a rate limit error, implement exponential backoff
        if (error.message?.includes('rate') || error.message?.includes('429')) {
          const backoffTime = Math.min(1000 * Math.pow(2, results.length % 5), 30000);
          console.log(`Rate limit error detected, backing off for ${backoffTime}ms`);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
          rateLimitDelayMs += backoffTime;
        }
      }
    }
    
    if (rateLimitDelayMs > 0) {
      console.log(`Total processing time included ${rateLimitDelayMs}ms of rate limit delays`);
    }
    
    return results;
  }

  private async markAsProcessedPersistent(event: any, analysis: any) {
    if (this.storage) {
      try {
        const eventHash = await this.storage.getEventHash(event);
        await this.storage.markEventProcessed(
          event.id,
          eventHash,
          analysis.isRelevant || false,
          analysis,
          analysis.llmModel
        );
      } catch (error) {
        console.error('Error marking event as processed in storage:', error);
        // Fallback to in-memory
        this.markAsProcessed(event, analysis);
      }
    } else {
      // Fallback to in-memory
      this.markAsProcessed(event, analysis);
    }
  }

  async generateInsights(contactData: any): Promise<{
    summary: string;
    nextSteps: string[];
    riskFactors: string[];
  }> {
    try {
      const prompt = `You are an expert wellness coach analyzing client data for actionable insights.

        CLIENT DATA:
        ${JSON.stringify(contactData, null, 2)}

        Analyze this data focusing on:

        1. ENGAGEMENT PATTERNS:
        - Session frequency and consistency
        - Communication patterns (emails, messages)
        - Appointment adherence (kept vs cancelled)
        - Response time to communications

        2. PROGRESS INDICATORS:
        - Sentiment trends over time (if available)
        - Health improvements or setbacks mentioned
        - Goal achievement progress
        - Mood/energy patterns

        3. RISK ASSESSMENT:
        - Declining engagement (fewer sessions, delayed responses)
        - Negative sentiment patterns
        - Missed appointments without rescheduling
        - Long gaps between contacts
        - Any crisis indicators in communications

        4. RELATIONSHIP HEALTH:
        - Overall satisfaction indicators
        - Trust and rapport signals
        - Commitment level to wellness journey

        Based on your analysis, provide a JSON response with:

        {
        "summary": "A 2-3 sentence overview highlighting the most important patterns. Include: current engagement level, progress trajectory, and primary area needing attention. Be specific with timeframes (e.g., 'over the past month').",
        
        "nextSteps": [
            "Specific, actionable recommendations (3-5 items)",
            "Include timeframes (e.g., 'Schedule check-in within 48 hours')",
            "Prioritize based on urgency and impact",
            "Consider both clinical and relationship aspects"
        ],
        
        "riskFactors": [
            "Specific concerns with severity indicators",
            "Include timeframe when issue emerged",
            "Actionable mitigation strategies",
            "Format: 'Risk: [issue] - Action: [what to do]'"
        ]
        }

        IMPORTANT CONSIDERATIONS:
        - If data is limited, acknowledge this in the summary
        - Prioritize client retention and wellbeing
        - Be constructive and solution-focused
        - Consider seasonal/temporal factors
        - Look for both obvious and subtle patterns
        - If sentiment data exists, weight recent trends more heavily`;

      const response = await openrouter.chat.completions.create({
        model: 'moonshotai/kimi-k2', // Kimi K2
        messages: [
          {
            role: 'system',
            content:
              'You are a wellness coaching insights expert. Analyze client data to identify patterns, risks, and opportunities for better care. Always provide specific, actionable insights based on the actual data provided.',
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
      });

      let content =
        response.choices[0].message.content ||
        '{"summary": "No insights available", "nextSteps": [], "riskFactors": []}';
      content = extractJSON(content);

      const result = JSON.parse(content);

      // Validate and ensure arrays
      return {
        summary: result.summary || 'Unable to generate summary.',
        nextSteps: Array.isArray(result.nextSteps) ? result.nextSteps : [],
        riskFactors: Array.isArray(result.riskFactors) ? result.riskFactors : [],
      };
    } catch (error) {
      console.error('OpenRouter insights generation error:', error);
      return {
        summary: 'Unable to generate insights at this time.',
        nextSteps: [],
        riskFactors: [],
      };
    }
  }

  async analyzeCalendarEvent(event: any, contacts: any[], useFreeModel: boolean = false): Promise<CalendarEventAnalysis> {
    const eventData = event.rawData as any;
    const knownContactEmails = new Set(contacts.map(c => c.email.toLowerCase()));
    
    // Pre-filter attendees
    const attendees = event.attendees 
      ? (event.attendees as any[])
          .filter((a) => a.email && !this.isNoReplyEmail(a.email))
          .map((a) => ({
            email: a.email.toLowerCase(),
            isKnownContact: knownContactEmails.has(a.email.toLowerCase())
          }))
      : [];

    const hasKnownContacts = attendees.some(a => a.isKnownContact);
    
    const prompt = `
Analyze this calendar event for a wellness/coaching CRM. Your primary task is to determine if this event is relevant to the user's professional practice.

EVENT DETAILS:
- Title: ${event.summary || 'No title'}
- Description: ${event.description || 'No description'}
- Start: ${event.startTime?.toISOString() || 'Unknown'}
- End: ${event.endTime?.toISOString() || 'Unknown'}
- Location: ${event.location || 'No location'}
- Meeting Type: ${event.meetingType || 'Unknown'}
- Attendees: ${JSON.stringify(attendees)}
- Has Known Client Contacts: ${hasKnownContacts}

FILTERING CRITERIA:
1. RELEVANCE: Only mark as relevant if the event appears to be:
   - A client session (therapy, coaching, wellness, consultation)
   - A business meeting related to the practice
   - Professional development or training
   - Administrative work for the practice

2. EXCLUDE events that are clearly:
   - Personal appointments (doctor, dentist, personal errands)
   - Social events unrelated to business
   - Automated calendar entries (birthdays, holidays)
   - Spam or marketing events
   - Events with only no-reply email addresses
   - Events with no known contacts AND no clear business purpose

3. BE CONSERVATIVE: When in doubt, mark as not relevant.

Return a JSON object:
{
  "isRelevant": boolean, // PRIMARY FILTER: false if event should be ignored
  "relevanceReason": "string explaining why relevant or not",
  "eventType": "client_session" | "consultation" | "group_session" | "admin" | "training" | "personal" | "spam" | "unknown",
  "isClientRelated": boolean,
  "clientEmails": ["only emails of known contacts"],
  "sessionType": "therapy" | "coaching" | "wellness" | "consultation" | "group" | "other" | null,
  "keyTopics": ["only if relevant"],
  "actionItems": ["only if relevant"],
  "notes": "Brief summary only if relevant",
  "confidence": 0.0-1.0,
  "suggestedAction": "process" | "ignore" | "review"
}`;

    try {
      // Choose model based on usage scenario
      const model = useFreeModel ? 'meta-llama/llama-3.1-8b-instruct:free' : 'qwen/qwen3-235b-a22b-2507';
      
      const response = await openrouter.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content:
              'You are an AI assistant specialized in analyzing calendar events for wellness and coaching professionals. Your primary job is to filter out irrelevant events to save processing costs. Be conservative - when in doubt, mark as not relevant.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.1,
        max_tokens: 1000,
        response_format: { type: 'json_object' },
      });

      let content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenRouter');
      }

      content = extractJSON(content);
      const extractedData = JSON.parse(content) as CalendarEventAnalysis;
      
      // Add metadata
      const result = {
        ...extractedData,
        processedAt: new Date().toISOString(),
        llmModel: model,
        eventId: event.id
      };

      return result;
    } catch (error) {
      console.error('Error calling OpenRouter:', error);
      throw error;
    }
  }
}

// Export factory function to allow storage injection
export const createOpenRouterService = (storage?: any) => new OpenRouterService(storage);

// Default instance for backward compatibility
export const openRouterService = new OpenRouterService();
