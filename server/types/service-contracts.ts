/**
 * Internal Service Contract Definitions
 *
 * This file contains interface definitions that describe our internal service contracts,
 * dependency injection interfaces, and service configuration types.
 */

import type {
  User,
  Contact,
  ProcessedEvent,
  CalendarEvent,
  DataProcessingJob,
  InsertDataProcessingJob,
  AiSuggestion,
  InsertAiSuggestion,
  Task,
  InsertTask,
  TaskActivity,
  InsertTaskActivity,
  Interaction,
  InsertInteraction,
  InsertContact,
} from '../../shared/schema.js';
// CalendarEventAnalysis is now defined in this file
import type { ContactData, UnknownObject } from './external-apis.js';

// ============================================================================
// Storage Service Contracts
// ============================================================================

/**
 * Storage interface for dependency injection
 * Defines the contract for data persistence operations
 */
export interface StorageInterface {
  // Event Processing Methods
  getProcessedEvents?(): Promise<ProcessedEvent[]>;
  saveProcessedEvent?(event: ProcessedEvent): Promise<void>;
  shouldProcessEvent?(eventId: string): Promise<boolean>;
  markEventProcessed(
    eventId: string,
    eventHash: string,
    isRelevant: boolean,
    analysis?: CalendarEventAnalysis,
    llmModel?: string
  ): Promise<ProcessedEvent>;
  getEventHash?(event: CalendarEvent): Promise<string>;

  // Contact Methods
  getContacts?(userId: string): Promise<ContactData[]>;
  getContactsByUserId?(userId: string): Promise<Contact[]>;
  getContact(id: string): Promise<Contact | undefined>;
  updateContact(id: string, contact: Partial<InsertContact>): Promise<Contact>;

  // User Methods
  getUser?(id: string): Promise<User | undefined>;

  // Data Processing Job Methods
  createDataProcessingJob(job: InsertDataProcessingJob): Promise<DataProcessingJob>;
  updateDataProcessingJob(
    id: string,
    job: Partial<InsertDataProcessingJob>
  ): Promise<DataProcessingJob>;

  // AI Suggestion Methods
  createAiSuggestion(suggestion: InsertAiSuggestion): Promise<AiSuggestion>;
  updateAiSuggestion(id: string, suggestion: Partial<InsertAiSuggestion>): Promise<AiSuggestion>;
  getAiSuggestion(id: string): Promise<AiSuggestion | undefined>;

  // Task Methods
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, task: Partial<InsertTask>): Promise<Task>;

  // Task Activity Methods
  createTaskActivity(activity: InsertTaskActivity): Promise<TaskActivity>;

  // Interaction Methods
  createInteraction(interaction: InsertInteraction): Promise<Interaction>;
}

// ============================================================================
// LLM Service Contracts
// ============================================================================

/**
 * LLM Processor interface defining the contract for language model operations
 */
export interface LLMProcessor {
  processPrompt(): Promise<string>;
  processCalendarEvents(): Promise<void>;
  processWithKimi(): Promise<string>;
  processAllUsers(): Promise<void>;
}

/**
 * Configuration interface for LLM services
 */
export interface LLMServiceConfig {
  defaultConcurrencyLimit: number;
  defaultBatchSize: number;
  defaultBatchDelay: number;
  enableCostTracking: boolean;
  enablePerformanceMonitoring: boolean;
}

/**
 * Processing context for LLM operations
 */
export interface ProcessingContext {
  userId: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Generic analysis result structure for LLM operations
 */
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

/**
 * Calendar service contract for calendar event processing
 */
export interface CalendarService {
  processEvents(events: CalendarEvent[]): Promise<CalendarEventAnalysis[]>;
  analyzeEvent(event: CalendarEvent): Promise<CalendarEventAnalysis>;
  shouldProcessEvent(event: CalendarEvent): Promise<boolean>;
  getRelevantEvents(
    userId: string,
    dateRange?: { start: Date; end: Date }
  ): Promise<CalendarEvent[]>;
}
/**
 * Calendar event analysis result from LLM processing
 */
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
    | 'unknown'
    | 'other';
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

// ============================================================================
// Metrics and Monitoring Contracts
// ============================================================================

/**
 * Processing metrics for service monitoring
 */
export interface ProcessingMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgProcessingTime: number;
  totalCost: number;
  concurrencyStats: ConcurrencyStats;
}

/**
 * Concurrency statistics for performance monitoring
 * Unified interface used by LLMConcurrencyController and other services
 */
export interface ConcurrencyStats {
  active: number;
  queued: number;
  completed: number;
  failed: number;
  avgProcessingTime: number;
}

/**
 * Error context for debugging and monitoring
 */
export interface ErrorContext {
  operation: string;
  userId?: string;
  taskId?: string;
  timestamp: Date;
}

/**
 * LLM request priority levels
 */
export type LLMRequestPriority = 'high' | 'medium' | 'low';

/**
 * Queued LLM request structure for concurrency control
 */
export interface QueuedRequest<T> {
  id: string;
  operation: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
  priority: LLMRequestPriority;
  timestamp: number;
  userId: string;
  model: string;
}

/**
 * LLM batch execution options
 */
export interface LLMBatchOptions {
  batchSize?: number;
  delayBetweenBatches?: number;
  timeout?: number;
}

/**
 * LLM cost tracking interface
 */
export interface LLMCostTracking {
  trackUsage(userId: string, tokens: number, model: string): void;
  getDailyUsage(userId: string): LLMUsageStats;
  checkDailyLimit(userId: string): boolean;
}

/**
 * Daily LLM usage statistics
 */
export interface LLMUsageStats {
  requests: number;
  tokens: number;
  cost: number;
}

// ============================================================================
// Task and Project Service Contracts
// ============================================================================

/**
 * Task strategy interface for AI-driven task management
 */
export interface TaskStrategy {
  strategy: string;
  contactSegments: ContactSegment[];
  recommendations: string[];
  estimatedTime: string;
}

/**
 * Contact segment for targeted task assignment
 */
export interface ContactSegment {
  segment: string;
  contacts: string[];
  approach: string;
}

/**
 * Task analysis result with strategy and recommendations
 */
export interface TaskAnalysis {
  strategy: string;
  contactSegments: ContactSegment[];
  recommendations: string[];
  estimatedTime: string;
  personalizedApproaches?: Record<string, string>;
}

/**
 * Bulk action interface for batch operations
 */
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

// ============================================================================
// Data Processing Contracts
// ============================================================================

/**
 * Interaction data structure for service communication
 */
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

// ============================================================================
// Email Service Contracts
// ============================================================================

/**
 * Email filter configuration for email processing services
 */
export interface EmailFilterConfig {
  maxEmails: number;
  daysBack: number;
  businessHoursOnly: boolean;
  excludePromotions: boolean;
  excludeSocial: boolean;
}

// ============================================================================
// Analytics and Insights Contracts
// ============================================================================

/**
 * Attendance analysis result structure
 */
export interface AttendanceAnalysis {
  attendeeCount: number;
  matchedContacts: number;
  unmatchedAttendees: string[];
  analysis: string;
}

/**
 * Photo enrichment analysis result
 */
export interface PhotoEnrichmentAnalysis {
  contactId: string;
  suggestions: Array<{
    photoUrl: string;
    source: string;
    confidence: number;
    [key: string]: unknown;
  }>;
  data?: UnknownObject;
  metadata?: UnknownObject;
}
