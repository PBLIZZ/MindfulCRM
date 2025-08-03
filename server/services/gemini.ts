import { GoogleGenerativeAI } from '@google/generative-ai';
import type { UnknownObject } from '../types/llm-types.js';
import { sanitizeForLLM } from '../utils/sanitizers.js';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY ?? '');
const geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

export class GeminiService {
  async generateChatResponse(message: string, context?: UnknownObject): Promise<string> {
    try {
      // Sanitize user input to prevent prompt injection
      const sanitizedMessage = sanitizeForLLM(message);
      const sanitizedContext = context
        ? sanitizeForLLM(JSON.stringify(context))
        : 'No specific context provided';

      const systemPrompt = `You are an AI assistant for a wellness solopreneur's client relationship management system. 
      You help analyze client data, provide insights, and suggest next steps for client care. 
      Be professional, empathetic, and focused on wellness outcomes.
      
      Current context: ${sanitizedContext}`;

      const result = await geminiModel.generateContent([
        { text: systemPrompt },
        { text: sanitizedMessage },
      ]);

      return result.response.text() || "I'm sorry, I couldn't generate a response at this time.";
    } catch (error) {
      console.error('Gemini API error:', error);
      throw new Error(
        'Failed to generate AI response. Please check your Google API configuration.'
      );
    }
  }
}

export const geminiService = new GeminiService();
