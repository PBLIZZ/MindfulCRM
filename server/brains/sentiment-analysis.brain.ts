import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { sanitizeEmailContent } from '../utils/sanitizers.js';

// This generic interface remains unchanged, allowing any provider to be used.
interface LLMProvider {
  generateCompletion(
    model: string,
    messages: ChatCompletionMessageParam[],
    isJson: boolean
  ): Promise<string>;
}

export type SentimentAnalysisOutput = {
  rating: number;
  confidence: number;
};

export class SentimentAnalysisBrain {
  // This method is now upgraded with the more sophisticated Mistral prompt.
  private buildMessages(rawText: string): ChatCompletionMessageParam[] {
    const systemPrompt = `You are analyzing communications for a wellness practitioner's CRM.

      First, classify the message type:
      - Client communication: appointments, health updates, feedback, questions.
      - Non-client: invoices, spam, marketing, supplier emails, system notifications.

      For NON-CLIENT messages, your JSON response MUST be: { "rating": 3, "confidence": 0.0 }

      For CLIENT messages, analyze sentiment considering these factors:
      - Health progress (improvements are positive, setbacks are negative).
      - Appointment requests/changes (neutral unless expressing strong emotion).
      - The emotional tone and any sense of urgency.
      - Satisfaction or dissatisfaction with treatment.

      Use this precise rating scale:
      1 = Very Negative (complaints, health crisis, very upset).
      2 = Negative (cancellations, mild complaints, setbacks).
      3 = Neutral (scheduling, factual questions, logistical matters).
      4 = Positive (good progress, gratitude, satisfaction).
      5 = Very Positive (major breakthroughs, high praise, successful outcomes).

      Your response MUST be ONLY a valid JSON object in this exact format: { "rating": number, "confidence": number }`;
    // Correctly using the specific sanitizer for email/message content.
    const sanitizedText = sanitizeEmailContent(rawText);

    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: sanitizedText },
    ];
  }

  // The execute method requires NO changes. It simply runs the prompt.
  async execute(
    provider: LLMProvider,
    model: string,
    textToAnalyze: string
  ): Promise<SentimentAnalysisOutput> {
    const messages = this.buildMessages(textToAnalyze);

    try {
      const rawResponse = await provider.generateCompletion(model, messages, true);
      const result = JSON.parse(rawResponse) as Partial<SentimentAnalysisOutput>;

      return {
        rating: Math.max(
          1,
          Math.min(5, Math.round(typeof result.rating === 'number' ? result.rating : 3))
        ),
        confidence: Math.max(
          0,
          Math.min(1, typeof result.confidence === 'number' ? result.confidence : 0.5)
        ),
      };
      // Return default values with neutral sentiment and low confidence if any error occurs.
    } catch (error) {
      console.error('Sentiment analysis execution failed:', error);
      return { rating: 3, confidence: 0.1 };
    }
  }
}
