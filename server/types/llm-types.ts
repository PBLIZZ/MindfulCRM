// Import ProcessedEvent type from schema
import type { ProcessedEvent } from '../../shared/schema.js';

export interface ProcessingContext {
  userId: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AnalysisResult<T = unknown> {
  success: boolean;
  data: T;
  error?: string;
  metadata?: {
    model?: string;
    tokens?: number;
    processingTime?: number;
  };
}

export interface AttendeeData {
  name: string;
  email?: string;
  status?: string;
}

export interface AttendanceRecord {
  attendees: AttendeeData[];
  className?: string;
  date?: string;
  instructor?: string;
}

export interface ContactSegment {
  segment: string;
  contacts: string[];
  approach: string;
}

export interface TaskStrategy {
  strategy: string;
  contactSegments: ContactSegment[];
  recommendations: string[];
  estimatedTime: string;
}

export interface InteractionData {
  contactId: string;
  type: string;
  content: string;
  timestamp: Date;
  sentiment?: number | null;
  subject?: string | null;
  source?: string | null;
  sourceId?: string | null;
}

// Calendar Event Processing Types
// ProcessedEvent type is imported from schema

export interface CalendarEventAnalysis {
  isRelevant: boolean;
  relevanceReason: string;
  eventType:
    | 'client_session'
    | 'consultation'
    | 'group_session'
    | 'admin'
    | 'training'
    | 'personal'
    | 'spam'
    | 'unknown';
  isClientRelated: boolean;
  clientEmails: string[];
  sessionType: 'therapy' | 'coaching' | 'wellness' | 'consultation' | 'group' | 'other' | null;
  keyTopics: string[];
  actionItems: string[];
  notes: string;
  confidence: number;
  suggestedAction: 'process' | 'ignore' | 'review';
  // Additional metadata properties
  processedAt?: string;
  llmModel?: string;
  eventId?: string;
  skipped?: boolean;
  // Index signature to allow use as Record<string, unknown>
  [key: string]: unknown;
}

// User types for authentication
export interface UserAuthData {
  id: string;
  googleId: string;
  email: string;
  name: string;
  picture?: string;
  accessToken: string;
  refreshToken: string;
}

export interface LLMProcessor {
  processPrompt(): Promise<string>;
  processPrompt(): Promise<string>;
  processCalendarEvents(): Promise<void>;
  processWithKimi(): Promise<string>;
  processAllUsers(): Promise<void>;
}

export interface ErrorContext {
  operation: string;
  userId?: string;
  taskId?: string;
  timestamp: Date;
}

// Storage interface for dependency injection
export interface StorageInterface {
  getProcessedEvents?(): Promise<ProcessedEvent[]>;
  saveProcessedEvent?(event: ProcessedEvent): Promise<void>;
  getContacts?(userId: string): Promise<ContactData[]>;
  shouldProcessEvent?(eventId: string): Promise<boolean>;
  markEventProcessed(
    eventId: string,
    eventHash: string,
    isRelevant: boolean,
    analysis?: CalendarEventAnalysis,
    llmModel?: string
  ): Promise<ProcessedEvent>;
  // Add other storage methods as needed
}

// Contact data interface - use Drizzle-inferred types
// Import the proper Contact type from schema
export type ContactData = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  status: string | null;
  lifecycleStage: string | null;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  lastContact: Date | null;
  sentiment: number | null;
  // Following Data Doctrine: Backend uses null, matches database schema
};

// Email filter interfaces
export interface EmailFilterConfig {
  maxEmails: number;
  daysBack: number;
  businessHoursOnly: boolean;
  excludePromotions: boolean;
  excludeSocial: boolean;
}

// Google Auth profile interface
export interface GoogleAuthProfile {
  id: string;
  displayName: string;
  emails: Array<{ value: string; verified?: boolean }>;
  photos?: Array<{ value: string }>;
  provider: string;
}

// Passport done callback type
export type PassportDoneCallback = (user?: UserAuthData | false) => void;

// General purpose object type for legacy any usage
export type UnknownObject = Record<string, unknown>;

// Task AI specific types
export interface AttendanceAnalysis {
  attendeeCount: number;
  matchedContacts: number;
  unmatchedAttendees: string[];
  analysis: string;
}

export interface TaskAnalysis {
  strategy: string;
  contactSegments: ContactSegment[];
  recommendations: string[];
  estimatedTime: string;
  personalizedApproaches?: Record<string, string>;
}

export interface BulkAction {
  type: 'bulk_timeline_update' | 'bulk_photo_update' | 'bulk_contact_update';
  contactIds: string[];
  eventData?: {
    className: string;
    date: string;
    [key: string]: unknown;
  };
  updates?: Array<{
    contactId: string;
    photoUrl: string;
    source: string;
    [key: string]: unknown;
  }>;
  data?: UnknownObject;
  metadata?: UnknownObject;
}
