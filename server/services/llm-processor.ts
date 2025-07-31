import { storage } from '../storage';
import type { User, CalendarEvent } from '@shared/schema';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export class LLMProcessor {
  /**
   * Process unprocessed calendar events for a user
   * Extracts client sessions, appointments, and insights
   */
  async processCalendarEvents(user: User): Promise<void> {
    try {
      console.log(`Starting LLM processing for user ${user.email}`);
      
      const unprocessedEvents = await storage.getUnprocessedCalendarEvents(user.id);
      console.log(`Found ${unprocessedEvents.length} unprocessed calendar events`);

      if (unprocessedEvents.length === 0) {
        return;
      }

      // Get all user contacts for matching
      const contacts = await storage.getContactsByUserId(user.id);
      
      for (const event of unprocessedEvents) {
        try {
          const extractedData = await this.analyzeCalendarEvent(event, contacts);
          
          // Update the event with extracted data and mark as processed
          await storage.markCalendarEventProcessed(event.id, extractedData);
          
          console.log(`Processed event: ${event.summary} - Type: ${extractedData.eventType}`);
        } catch (error) {
          console.error(`Error processing event ${event.id}:`, error);
          // Mark as processed with error to avoid reprocessing
          await storage.markCalendarEventProcessed(event.id, {
            error: error instanceof Error ? error.message : 'Unknown error',
            eventType: 'unknown'
          });
        }
      }

      console.log(`Completed LLM processing for user ${user.email}`);
    } catch (error) {
      console.error('LLM processing error:', error);
    }
  }

  /**
   * Analyze a single calendar event using LLM
   */
  private async analyzeCalendarEvent(event: CalendarEvent, contacts: any[]): Promise<any> {
    const eventData = event.rawData as any;
    
    // Prepare context for the LLM
    const contactEmails = contacts.map(c => c.email).join(', ');
    const attendeeEmails = event.attendees ? 
      (event.attendees as any[]).map(a => a.email).filter(email => email).join(', ') : 
      'No attendees';

    const prompt = `
Analyze this calendar event and extract meaningful insights for a wellness/coaching CRM:

EVENT DETAILS:
- Title: ${event.summary || 'No title'}
- Description: ${event.description || 'No description'}
- Start: ${event.startTime?.toISOString() || 'Unknown'}
- End: ${event.endTime?.toISOString() || 'Unknown'}
- Location: ${event.location || 'No location'}
- Meeting Type: ${event.meetingType || 'Unknown'}
- Attendees: ${attendeeEmails}

KNOWN CONTACTS: ${contactEmails || 'None'}

Please analyze this event and return a JSON object with the following structure:
{
  "eventType": "client_session" | "consultation" | "group_session" | "admin" | "personal" | "unknown",
  "isClientRelated": boolean,
  "clientEmails": ["email1@example.com"], // Array of client emails from attendees that match known contacts
  "sessionType": "therapy" | "coaching" | "wellness" | "consultation" | "group" | "other" | null,
  "keyTopics": ["topic1", "topic2"], // Extracted from title/description
  "mood": "positive" | "neutral" | "concerning" | null,
  "actionItems": ["action1", "action2"], // Any follow-ups mentioned
  "notes": "Brief summary of what this event represents",
  "confidence": 0.0-1.0 // How confident you are in this analysis
}

Focus on identifying:
1. Whether this is a client-related session/meeting
2. What type of wellness/coaching activity it might be
3. Any emotional indicators or important topics
4. Follow-up actions or next steps mentioned

Be conservative - if unsure, mark as "unknown" or "personal".
`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an AI assistant specialized in analyzing calendar events for wellness and coaching professionals. Extract meaningful insights while being conservative about client privacy.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 1000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      // Parse the JSON response
      const extractedData = JSON.parse(content);
      
      // Validate the response structure
      if (!extractedData.eventType || !extractedData.hasOwnProperty('isClientRelated')) {
        throw new Error('Invalid response structure from LLM');
      }

      // Add metadata
      extractedData.processedAt = new Date().toISOString();
      extractedData.llmModel = 'gpt-4';
      
      return extractedData;
    } catch (error) {
      console.error('Error calling OpenAI:', error);
      
      // Fallback analysis based on simple rules
      return this.fallbackAnalysis(event, contacts);
    }
  }

  /**
   * Fallback analysis when LLM is unavailable
   */
  private fallbackAnalysis(event: CalendarEvent, contacts: any[]): any {
    const eventData = event.rawData as any;
    const title = (event.summary || '').toLowerCase();
    const description = (event.description || '').toLowerCase();
    const attendees = event.attendees as any[] || [];
    
    // Check if any attendees are known contacts
    const clientEmails = attendees
      .filter(a => a.email && contacts.some(c => c.email === a.email))
      .map(a => a.email);
    
    const isClientRelated = clientEmails.length > 0;
    
    // Simple keyword-based classification
    let eventType = 'unknown';
    let sessionType = null;
    
    if (title.includes('session') || title.includes('therapy') || title.includes('coaching')) {
      eventType = 'client_session';
      sessionType = 'coaching';
    } else if (title.includes('consultation') || title.includes('intake')) {
      eventType = 'consultation';
      sessionType = 'consultation';
    } else if (title.includes('group') || title.includes('workshop')) {
      eventType = 'group_session';
      sessionType = 'group';
    } else if (isClientRelated) {
      eventType = 'client_session';
      sessionType = 'other';
    } else {
      eventType = 'personal';
    }
    
    return {
      eventType,
      isClientRelated,
      clientEmails,
      sessionType,
      keyTopics: [],
      mood: null,
      actionItems: [],
      notes: `Fallback analysis: ${eventType}`,
      confidence: 0.6,
      processedAt: new Date().toISOString(),
      llmModel: 'fallback',
    };
  }

  /**
   * Process all users' calendar events (for background job)
   */
  async processAllUsers(): Promise<void> {
    try {
      // This would typically get all users, but for now we'll use a placeholder
      // In a real implementation, you'd query all users from the database
      console.log('Background LLM processing started for all users');
      
      // For now, this is a placeholder - you'd implement user iteration here
      console.log('Background LLM processing completed');
    } catch (error) {
      console.error('Background LLM processing error:', error);
    }
  }
}

export const llmProcessor = new LLMProcessor();
