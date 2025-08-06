import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { sanitizeForLLM } from '../utils/sanitizers.js';

// A generic interface for the LLM provider.
interface LLMProvider {
  generateCompletion(
    model: string,
    messages: ChatCompletionMessageParam[],
    isJson: boolean
  ): Promise<string>;
}

export class ChatBrain {
  private buildMessages(
    rawMessage: string,
    rawContext?: Record<string, unknown>
  ): ChatCompletionMessageParam[] {
    const sanitizedMessage = sanitizeForLLM(rawMessage);
    const sanitizedContext = rawContext
      ? sanitizeForLLM(JSON.stringify(rawContext, null, 2))
      : 'No specific context provided';

    const systemPrompt = `You are an AI assistant for a wellness solopreneur's client relationship management system.
      You help analyze client data, provide insights, and suggest next steps for client care.
      Be professional, empathetic, and focused on wellness outcomes.

      Current context: ${sanitizedContext}`;

    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: sanitizedMessage },
    ];
  }

  async execute(
    provider: LLMProvider,
    model: string,
    message: string,
    context?: Record<string, unknown>
  ): Promise<string> {
    const messages = this.buildMessages(message, context);

    try {
      return await provider.generateCompletion(model, messages, false);
    } catch (error) {
      console.error('Chat brain execution failed:', error);
      return "I'm sorry, I couldn't generate a response at this time.";
    }
  }
}
