// Test-specific type definitions for dependency injection and mocking

export interface MockLLMProvider {
  generateCompletion: jest.MockedFunction<(model: string, messages: any[], isJson?: boolean) => Promise<string>>;
}

export interface MockGoogleProvider {
  getCalendarEvents: jest.MockedFunction<(userId: string, timeMin?: string, timeMax?: string) => Promise<any[]>>;
  getGmailMessages: jest.MockedFunction<(userId: string, query?: string) => Promise<any[]>>;
}

export interface TestUser {
  id: string;
  email: string;
  name: string;
  googleId?: string;
}

export interface TestContact {
  id: string;
  userId: string;
  name: string;
  email?: string;
  phone?: string;
  hasGdprConsent?: boolean;
}

export interface TestContext {
  user: TestUser;
  contacts: TestContact[];
  cleanup: () => Promise<void>;
}

// Database seeding interfaces
export interface TestDataSeed {
  users: TestUser[];
  contacts: TestContact[];
  tags: Array<{ id: string; name: string; color: string }>;
  interactions: Array<{
    id: string;
    contactId: string;
    type: string;
    content: string;
    createdAt: Date;
  }>;
}

// Mock service configuration
export interface MockServiceConfig {
  enableLLMCalls: boolean;
  enableGoogleAPICalls: boolean;
  enableDatabaseOperations: boolean;
  mockLatency: boolean;
  defaultResponses: {
    llm: string;
    calendar: any[];
    gmail: any[];
  };
}
