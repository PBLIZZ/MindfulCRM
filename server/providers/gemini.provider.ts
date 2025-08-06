import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

// Define the models this provider supports for easy updates
type SupportedGeminiModel = 'gemini-2.0-flash-exp' | 'gemini-2.0-flash' | 'gemini-1.5-pro';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY ?? '');

class GeminiService {
  /**
   * A generic method to get a completion from a supported Gemini model.
   * @param model The specific Gemini model to use.
   * @param messages The array of messages for the completion.
   * @param isJson A boolean to request a JSON response format (not supported by Gemini).
   * @returns The string content of the AI's response.
   */
  async generateCompletion(
    model: SupportedGeminiModel,
    messages: ChatCompletionMessageParam[],
    isJson: boolean = false
  ): Promise<string> {
    if (!process.env.GOOGLE_API_KEY) {
      throw new Error('Google API key (GOOGLE_API_KEY) is not set.');
    }

    try {
      const geminiModel = genAI.getGenerativeModel({
        model,
        // Define default safety settings for responsible AI usage
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
        ],
      });

      // The Gemini SDK's `generateContent` takes a simple array of strings/parts.
      // We will combine our structured messages into the format it expects.
      const promptParts = messages.map((msg) => {
        // Handle different content types from ChatCompletionMessageParam
        if (typeof msg.content === 'string') {
          return msg.content;
        } else if (Array.isArray(msg.content)) {
          // For array content, extract text parts
          return msg.content
            .filter((part) => part.type === 'text')
            .map((part) => part.text)
            .join(' ');
        } else {
          return ''; // Handle null/undefined content
        }
      }).filter(part => part.length > 0); // Remove empty parts

      // Note: Gemini doesn't support JSON mode like OpenAI, so we ignore the isJson parameter
      if (isJson) {
        console.warn('Gemini provider does not support JSON mode. Ignoring isJson parameter.');
      }

      const result = await geminiModel.generateContent(promptParts);

      return result.response.text();
    } catch (error) {
      console.error(`Gemini API error for model ${model}:`, error);
      throw new Error(`Failed to generate response from Gemini model: ${model}.`);
    }
  }
}

export const geminiService = new GeminiService();
