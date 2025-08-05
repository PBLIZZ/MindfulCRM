import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Define the models this provider supports, making it easy to update
type SupportedOpenAIModel = 'gpt-4o' | 'gpt-4o-mini';

class OpenAIService {
  /**
   * A generic method to get a chat completion from a supported OpenAI model.
   * @param model The specific OpenAI model to use.
   * @param messages The array of messages for the chat completion.
   * @param isJson A boolean to request a JSON response format.
   * @returns The string content of the AI's response.
   */
  async generateCompletion(
    model: SupportedOpenAIModel,
    messages: ChatCompletionMessageParam[],
    isJson: boolean = false
  ): Promise<string> {
    try {
      const response = await openai.chat.completions.create({
        model,
        messages,
        response_format: isJson ? { type: 'json_object' } : undefined,
      });
      return response.choices[0].message.content ?? '';
    } catch (error) {
      console.error(`OpenAI API error for model ${model}:`, error);
      // Throw a new error to be caught by the calling service, which will handle user-facing errors.
      throw new Error(`Failed to generate response from OpenAI model: ${model}.`);
    }
  }
}

export const openaiService = new OpenAIService();
