/**
 * Mock implementations for AI providers (OpenAI, Gemini, Mistral)
 * Used across all tests to prevent real API calls and ensure deterministic results
 */

import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

// Mock responses for consistent testing
export const MOCK_RESPONSES = {
  CONTACT_INSIGHTS: JSON.stringify({
    overallSentiment: 4.2,
    engagement: 'high',
    insights: ['Very engaged client', 'Responds quickly to communications'],
    recommendations: ['Continue current approach', 'Consider premium services']
  }),
  CHAT_RESPONSE: 'This is a mock response from the AI assistant.',
  PHOTO_ANALYSIS: JSON.stringify({
    confidence: 0.85,
    suggestions: [
      {
        url: 'https://example.com/photo1.jpg',
        source: 'linkedin',
        confidence: 0.9
      }
    ]
  }),
  CALENDAR_EXTRACT: JSON.stringify({
    extractedData: {
      attendees: ['test@example.com'],
      importance: 'high',
      category: 'wellness_session'
    }
  })
};

// OpenAI Mock
export const mockOpenAI = {
  chat: {
    completions: {
      create: jest.fn().mockImplementation(async ({ messages, response_format }: {
        messages: ChatCompletionMessageParam[];
        response_format?: { type: string };
      }) => {
        const lastMessage = messages[messages.length - 1];
        let content = MOCK_RESPONSES.CHAT_RESPONSE;

        // Return appropriate mock responses based on message content
        if (typeof lastMessage.content === 'string') {
          if (lastMessage.content.includes('insight')) {
            content = MOCK_RESPONSES.CONTACT_INSIGHTS;
          } else if (lastMessage.content.includes('photo')) {
            content = MOCK_RESPONSES.PHOTO_ANALYSIS;
          } else if (lastMessage.content.includes('calendar')) {
            content = MOCK_RESPONSES.CALENDAR_EXTRACT;
          }
        }

        return {
          choices: [{
            message: { content },
            finish_reason: 'stop'
          }],
          usage: {
            prompt_tokens: 100,
            completion_tokens: 50,
            total_tokens: 150
          }
        };
      })
    }
  }
};

// Gemini Mock
export const mockGeminiService = {
  generateCompletion: jest.fn().mockImplementation(async (
    model: string,
    messages: ChatCompletionMessageParam[],
    isJson: boolean = false
  ) => {
    const lastMessage = messages[messages.length - 1];
    let content = MOCK_RESPONSES.CHAT_RESPONSE;

    if (typeof lastMessage.content === 'string' && lastMessage.content.includes('insight')) {
      content = MOCK_RESPONSES.CONTACT_INSIGHTS;
    }

    return content;
  }),

  // Legacy methods for backward compatibility
  generateText: jest.fn().mockResolvedValue(MOCK_RESPONSES.CHAT_RESPONSE),
  generateJSON: jest.fn().mockResolvedValue(MOCK_RESPONSES.CONTACT_INSIGHTS)
};

// OpenRouter Mock (used in ai.service.ts)
export const mockOpenRouter = {
  chat: {
    completions: {
      create: jest.fn().mockImplementation(async ({ messages, model }: {
        messages: ChatCompletionMessageParam[];
        model: string;
      }) => {
        const lastMessage = messages[messages.length - 1];
        let content = MOCK_RESPONSES.CHAT_RESPONSE;

        if (typeof lastMessage.content === 'string') {
          if (lastMessage.content.includes('insight')) {
            content = MOCK_RESPONSES.CONTACT_INSIGHTS;
          } else if (lastMessage.content.includes('extract')) {
            content = MOCK_RESPONSES.CALENDAR_EXTRACT;
          }
        }

        return {
          choices: [{
            message: { content },
            finish_reason: 'stop'
          }],
          usage: {
            prompt_tokens: model.includes('kimi') ? 200 : 100,
            completion_tokens: model.includes('kimi') ? 100 : 50,
            total_tokens: model.includes('kimi') ? 300 : 150
          }
        };
      })
    }
  }
};

// Google APIs Mock (Calendar, Gmail)
export const mockGoogleApis = {
  calendar: {
    events: {
      list: jest.fn().mockResolvedValue({
        data: {
          items: [
            {
              id: 'mock-event-1',
              summary: 'Test Meditation Session',
              description: 'Weekly session with Sarah',
              start: { dateTime: '2025-08-07T10:00:00Z' },
              end: { dateTime: '2025-08-07T11:00:00Z' },
              attendees: [{ email: 'sarah@example.com' }]
            }
          ]
        }
      }),
      get: jest.fn().mockResolvedValue({
        data: {
          id: 'mock-event-1',
          summary: 'Test Event',
          start: { dateTime: '2025-08-07T10:00:00Z' },
          end: { dateTime: '2025-08-07T11:00:00Z' }
        }
      })
    }
  },
  gmail: {
    users: {
      messages: {
        list: jest.fn().mockResolvedValue({
          data: {
            messages: [
              { id: 'mock-message-1', threadId: 'mock-thread-1' }
            ]
          }
        }),
        get: jest.fn().mockResolvedValue({
          data: {
            id: 'mock-message-1',
            payload: {
              headers: [
                { name: 'Subject', value: 'Test Email' },
                { name: 'From', value: 'test@example.com' }
              ],
              body: {
                data: Buffer.from('Test email content').toString('base64')
              }
            }
          }
        })
      }
    }
  }
};

// Rate Limiter Mock
export const mockRateLimiter = {
  checkRateLimit: jest.fn().mockResolvedValue({ allowed: true, resetTime: Date.now() + 3600000 }),
  getUsageStats: jest.fn().mockResolvedValue({
    requestsToday: 50,
    requestsThisHour: 5,
    dailyLimit: 1000,
    hourlyLimit: 100,
    resetTime: Date.now() + 3600000
  }),
  getRecommendedModel: jest.fn().mockReturnValue({
    model: 'meta-llama/llama-3.1-8b-instruct:free',
    reasoning: 'Cost-effective for testing'
  })
};

// File system operations mock
export const mockFs = {
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  unlinkSync: jest.fn(),
  statSync: jest.fn().mockReturnValue({ size: 1024 })
};

// Sharp image processing mock
export const mockSharp = jest.fn().mockReturnValue({
  resize: jest.fn().mockReturnThis(),
  webp: jest.fn().mockReturnThis(),
  toFile: jest.fn().mockResolvedValue({ size: 1024 })
});

// Reset all mocks utility
export function resetAllMocks(): void {
  jest.clearAllMocks();

  // Reset specific mock implementations that might have been overridden
  mockOpenAI.chat.completions.create.mockImplementation(async () => ({
    choices: [{ message: { content: MOCK_RESPONSES.CHAT_RESPONSE } }]
  }));

  mockGeminiService.generateCompletion.mockResolvedValue(MOCK_RESPONSES.CHAT_RESPONSE);
}
