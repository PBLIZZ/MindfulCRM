import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
// CORRECT: Importing types directly from the single source of truth.
import { type Contact, type Interaction, type Goal } from '../../shared/schema.js';
import { sanitizeContactInfo } from '../utils/sanitizers.js';

// A generic interface for the LLM provider.
interface LLMProvider {
  generateCompletion(
    model: string,
    messages: ChatCompletionMessageParam[],
    isJson: boolean
  ): Promise<string>;
}
// CORRECT: This type is now COMPOSED of the official, Drizzle-inferred types.
// It does not redefine them. This fully complies with the Data Doctrine.
export type InsightBrainInput = Contact & { interactions: Interaction[]; goals: Goal[] };

// Define the exact output structure this Brain guarantees.
export type InsightBrainOutput = {
  summary: string;
  nextSteps: string[];
  riskFactors: string[];
};

export class GenerateInsightsBrain {
  private buildMessages(contactData: InsightBrainInput): ChatCompletionMessageParam[] {
    // The data passed in here will have `null` values, which is correct for the backend    // Correctly using the specific sanitizer before stringifying.
    const sanitizedDataString = sanitizeContactInfo(JSON.stringify(contactData, null, 2));

    const prompt = `You are an expert wellness coach analyzing client data for actionable insights.

        CLIENT DATA:
        ${sanitizedDataString}

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

    return [
      {
        role: 'system',
        content: 'You are a wellness coaching insights expert. Analyze client data to identify patterns, risks, and opportunities for better care. Always provide specific, actionable insights based on the actual data provided.',
      },
      { role: 'user', content: prompt },
    ];
  }

  async execute(
    provider: LLMProvider,
    model: string,
    contactData: InsightBrainInput
  ): Promise<InsightBrainOutput> {
    const messages = this.buildMessages(contactData);

    try {
      const rawResponse = await provider.generateCompletion(model, messages, true);
      const result = JSON.parse(rawResponse) as Partial<InsightBrainOutput>;

      // Validate the output to ensure it matches our defined type.
      return {
        summary: typeof result.summary === 'string' ? result.summary : 'No insights available.',
        nextSteps: Array.isArray(result.nextSteps)
          ? result.nextSteps.filter((item): item is string => typeof item === 'string')
          : [],
        riskFactors: Array.isArray(result.riskFactors)
          ? result.riskFactors.filter((item): item is string => typeof item === 'string')
          : [],
      };
    } catch (error) {
      console.error(
        `Generate insights brain execution failed for contact ${contactData.id}:`,
        error
      );
      // ...and then THROW the error to notify the calling service of the failure.
      throw new Error('Failed to generate insights due to an LLM processing error.');
    }
  }
}
