import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key"
});

export class AIService {
  async generateChatResponse(message: string, context?: any): Promise<string> {
    try {
      const systemPrompt = `You are an AI assistant for a wellness solopreneur's client relationship management system. 
      You help analyze client data, provide insights, and suggest next steps for client care. 
      Be professional, empathetic, and focused on wellness outcomes.
      
      Current context: ${context ? JSON.stringify(context) : 'No specific context provided'}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ],
        max_tokens: 500,
        temperature: 0.7,
      });

      return response.choices[0].message.content || "I'm sorry, I couldn't generate a response at this time.";
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw new Error("Failed to generate AI response. Please check your OpenAI API configuration.");
    }
  }

  async analyzeSentiment(text: string): Promise<{ rating: number; confidence: number }> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a sentiment analysis expert. Analyze the sentiment of the text and provide a rating from 1 to 5 stars and a confidence score between 0 and 1. Respond with JSON in this format: { 'rating': number, 'confidence': number }"
          },
          { role: "user", content: text }
        ],
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(response.choices[0].message.content || '{"rating": 3, "confidence": 0.5}');

      return {
        rating: Math.max(1, Math.min(5, Math.round(result.rating))),
        confidence: Math.max(0, Math.min(1, result.confidence)),
      };
    } catch (error) {
      console.error('Sentiment analysis error:', error);
      return { rating: 3, confidence: 0.5 }; // Default neutral sentiment
    }
  }

  async generateInsights(contactData: any): Promise<{
    summary: string;
    nextSteps: string[];
    riskFactors: string[];
  }> {
    try {
      const prompt = `Analyze this client data and provide wellness coaching insights:
      ${JSON.stringify(contactData)}
      
      Provide a JSON response with:
      - summary: Brief overview of client progress
      - nextSteps: Array of recommended actions
      - riskFactors: Array of potential concerns to address`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
      });

      return JSON.parse(response.choices[0].message.content || '{"summary": "No insights available", "nextSteps": [], "riskFactors": []}');
    } catch (error) {
      console.error('Insights generation error:', error);
      return {
        summary: "Unable to generate insights at this time.",
        nextSteps: [],
        riskFactors: []
      };
    }
  }

  async transcribeAudio(audioBuffer: Buffer): Promise<string> {
    try {
      // Note: In a real implementation, you'd save the buffer to a temp file
      // and pass the file to the transcription API
      console.log('Audio transcription requested but not implemented in this demo');
      return "Audio transcription feature requires additional file handling implementation.";
    } catch (error) {
      console.error('Audio transcription error:', error);
      throw new Error("Failed to transcribe audio");
    }
  }
}

export const aiService = new AIService();
