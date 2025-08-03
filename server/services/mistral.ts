import dotenv from 'dotenv';
dotenv.config();

interface MistralResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
    completion_tokens: number;
  };
}

class MistralService {
  private apiKey: string;
  private baseURL = 'https://api.mistral.ai/v1';

  constructor() {
    this.apiKey = process.env.MISTRAL_API_KEY ?? '';
    if (!this.apiKey) {
      console.warn('MISTRAL_API_KEY not found in environment variables');
    }
  }

  async analyzeSentiment(text: string): Promise<{ rating: number; confidence: number }> {
    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'mistral-small-latest',
          messages: [
            {
              role: 'system',
              content: `You are analyzing communications for a wellness practitioner's CRM.

              First classify the message type:
              - Client communication: appointments, health updates, feedback, questions
              - Non-client: invoices, spam, marketing, supplier emails, system notifications

              For NON-CLIENT messages: return { "rating": 3, "confidence": 0.0 }

              For CLIENT messages, analyze sentiment considering:
              - Health progress (improvements = positive, setbacks = negative)  
              - Appointment requests/changes (neutral unless emotional)
              - Emotional tone and urgency
              - Satisfaction with treatment

              Rating scale:
              1 = Very negative (complaints, health crisis, very upset)
              2 = Negative (cancellations, mild complaints, setbacks)
              3 = Neutral (scheduling, factual questions)
              4 = Positive (improvements, gratitude, satisfaction)
              5 = Very positive (major breakthroughs, high praise)

              Return ONLY valid JSON: { "rating": number, "confidence": number }`,
            },
            { role: 'user', content: text },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        throw new Error(`Mistral API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as MistralResponse;
      const content = data.choices[0]?.message?.content || '{"rating": 3, "confidence": 0.5}';

      const result = JSON.parse(content) as {
        rating?: unknown;
        confidence?: unknown;
      };
      
      return {
        rating: Math.max(1, Math.min(5, Math.round(
          typeof result.rating === 'number' ? result.rating : 3
        ))),
        confidence: Math.max(0, Math.min(1, 
          typeof result.confidence === 'number' ? result.confidence : 0.5
        )),
      };
    } catch (error) {
      console.error('Mistral sentiment analysis error:', error);
      return { rating: 3, confidence: 0.5 };
    }
  }
}

export const mistralService = new MistralService();
