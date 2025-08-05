import dotenv from 'dotenv';
dotenv.config();

// Type definitions for the Mistral API structure
interface MistralMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface MistralResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

// Define the models this provider supports
type SupportedMistralModel = 'mistral-small-latest' | 'mistral-large-latest';

class MistralService {
  private apiKey: string;
  private baseURL = 'https://api.mistral.ai/v1';

  constructor() {
    this.apiKey = process.env.MISTRAL_API_KEY ?? '';
    if (!this.apiKey) {
      // Use console.warn for non-fatal configuration issues
      console.warn('MISTRAL_API_KEY is not set in environment variables.');
    }
  }

  /**
   * A generic method to get a chat completion from a supported Mistral model.
   * @param model The specific Mistral model to use.
   * @param messages The array of messages for the chat completion.
   * @param isJson A boolean to request a JSON response format.
   * @returns The string content of the AI's response.
   */
  async generateCompletion(
    model: SupportedMistralModel,
    messages: MistralMessage[],
    isJson: boolean = false
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Mistral API key is missing.');
    }

    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          response_format: isJson ? { type: 'json_object' } : undefined,
          temperature: 0.1, // A low temperature is good for structured tasks
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `Mistral API error: ${response.status} ${response.statusText} - ${errorBody}`
        );
      }

      const data = (await response.json()) as MistralResponse;
      return data.choices[0]?.message?.content ?? '';
    } catch (error) {
      console.error(`Mistral API error for model ${model}:`, error);
      throw new Error(`Failed to generate response from Mistral model: ${model}.`);
    }
  }
}

export const mistralService = new MistralService();
