import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');
const geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

export class GeminiService {
  async generateChatResponse(message: string, context?: any): Promise<string> {
    try {
      const systemPrompt = `You are an AI assistant for a wellness solopreneur's client relationship management system. 
      You help analyze client data, provide insights, and suggest next steps for client care. 
      Be professional, empathetic, and focused on wellness outcomes.
      
      Current context: ${context ? JSON.stringify(context) : 'No specific context provided'}`;

      const result = await geminiModel.generateContent([{ text: systemPrompt }, { text: message }]);

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
