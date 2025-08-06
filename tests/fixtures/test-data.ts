/**
 * Test fixtures providing consistent test data across all test suites
 */

import type { 
  Contact, 
  InsertContact,
  User,
  Tag,
  Interaction,
  CalendarEvent,
  AiSuggestion
} from '../../shared/schema.js';

// Base test user data
export const TEST_USERS = {
  WELLNESS_COACH: {
    id: 'test-user-wellness-coach',
    email: 'coach@mindfulcrm.com',
    name: 'Sarah Wellness Coach',
    googleId: 'google-123456',
    hasGoogleCalendarAccess: true,
    hasGmailAccess: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    tokens: null
  } satisfies User,

  MEDITATION_TEACHER: {
    id: 'test-user-meditation-teacher',
    email: 'teacher@mindfulcrm.com',
    name: 'Alex Meditation Teacher',
    googleId: 'google-789012',
    hasGoogleCalendarAccess: true,
    hasGmailAccess: false,
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
    tokens: null
  } satisfies User
} as const;

// Test contacts with various states
export const TEST_CONTACTS = {
  ENGAGED_CLIENT: {
    id: 'contact-engaged-sarah',
    userId: TEST_USERS.WELLNESS_COACH.id,
    name: 'Sarah Johnson',
    email: 'sarah.johnson@example.com',
    phone: '+1-555-0101',
    avatarUrl: '/uploads/contact-photos/sarah.webp',
    lifecycleStage: 'core_client' as const,
    sentiment: 5,
    engagementTrend: 'improving' as const,
    hasGdprConsent: true,
    lastContact: new Date('2025-08-05'),
    extractedFields: {
      company: 'Tech Solutions Inc',
      jobTitle: 'Product Manager',
      interests: ['meditation', 'yoga', 'mindfulness']
    },
    socialMediaHandles: {
      linkedin: 'https://linkedin.com/in/sarahjohnson',
      instagram: '@sarah_wellness'
    },
    createdAt: new Date('2024-06-01'),
    updatedAt: new Date('2025-08-05')
  } satisfies Contact,

  NEW_CLIENT: {
    id: 'contact-new-mike',
    userId: TEST_USERS.WELLNESS_COACH.id,
    name: 'Mike Chen',
    email: 'mike.chen@example.com',
    phone: '+1-555-0102',
    avatarUrl: null,
    lifecycleStage: 'new_client' as const,
    sentiment: 4,
    engagementTrend: 'stable' as const,
    hasGdprConsent: true,
    lastContact: new Date('2025-08-03'),
    extractedFields: {
      company: 'Startup Inc',
      jobTitle: 'Developer'
    },
    socialMediaHandles: null,
    createdAt: new Date('2025-07-15'),
    updatedAt: new Date('2025-08-03')
  } satisfies Contact,

  CURIOUS_PROSPECT: {
    id: 'contact-curious-emily',
    userId: TEST_USERS.WELLNESS_COACH.id,
    name: 'Emily Rodriguez',
    email: 'emily.rodriguez@example.com',
    phone: '+1-555-0103',
    avatarUrl: null,
    lifecycleStage: 'curious' as const,
    sentiment: 3,
    engagementTrend: 'declining' as const,
    hasGdprConsent: false,
    lastContact: new Date('2025-07-20'),
    extractedFields: null,
    socialMediaHandles: null,
    createdAt: new Date('2025-07-01'),
    updatedAt: new Date('2025-07-20')
  } satisfies Contact,

  // Contact without GDPR consent for photo enrichment tests
  NO_CONSENT_CLIENT: {
    id: 'contact-no-consent',
    userId: TEST_USERS.WELLNESS_COACH.id,
    name: 'John Privacy',
    email: 'john.privacy@example.com',
    phone: null,
    avatarUrl: null,
    lifecycleStage: 'new_client' as const,
    sentiment: 4,
    engagementTrend: 'stable' as const,
    hasGdprConsent: false,
    lastContact: new Date('2025-08-01'),
    extractedFields: null,
    socialMediaHandles: null,
    createdAt: new Date('2025-08-01'),
    updatedAt: new Date('2025-08-01')
  } satisfies Contact
} as const;

// Test tags
export const TEST_TAGS = {
  VIP_CLIENT: {
    id: 'tag-vip',
    name: 'VIP Client',
    color: '#FFD700',
    createdAt: new Date('2024-01-01')
  } satisfies Tag,

  NEW_MEMBER: {
    id: 'tag-new',
    name: 'New Member',
    color: '#32CD32',
    createdAt: new Date('2024-01-01')
  } satisfies Tag,

  NEEDS_FOLLOWUP: {
    id: 'tag-followup',
    name: 'Needs Follow-up',
    color: '#FF6347',
    createdAt: new Date('2024-01-01')
  } satisfies Tag
} as const;

// Test interactions
export const TEST_INTERACTIONS = {
  EMAIL_RESPONSE: {
    id: 'interaction-email-1',
    userId: TEST_USERS.WELLNESS_COACH.id,
    contactId: TEST_CONTACTS.ENGAGED_CLIENT.id,
    type: 'email',
    summary: 'Positive response to wellness program inquiry',
    content: 'Sarah expressed strong interest in our mindfulness program and asked about scheduling.',
    extractedFields: {
      sentiment: 'positive',
      nextAction: 'schedule_consultation',
      priority: 'high'
    },
    sentiment: 5,
    createdAt: new Date('2025-08-05'),
    updatedAt: new Date('2025-08-05')
  } satisfies Interaction,

  CALENDAR_SESSION: {
    id: 'interaction-calendar-1',
    userId: TEST_USERS.WELLNESS_COACH.id,
    contactId: TEST_CONTACTS.NEW_CLIENT.id,
    type: 'calendar',
    summary: 'Completed meditation session',
    content: 'Successful 60-minute mindfulness session. Client reported feeling more relaxed.',
    extractedFields: {
      sessionType: 'meditation',
      duration: 60,
      outcome: 'positive'
    },
    sentiment: 4,
    createdAt: new Date('2025-08-03'),
    updatedAt: new Date('2025-08-03')
  } satisfies Interaction
} as const;

// Test calendar events
export const TEST_CALENDAR_EVENTS = {
  MEDITATION_SESSION: {
    id: 'calendar-event-1',
    userId: TEST_USERS.WELLNESS_COACH.id,
    googleEventId: 'google-event-meditation-1',
    summary: 'Meditation Session with Sarah Johnson',
    description: 'Weekly mindfulness meditation session focusing on breath awareness and stress reduction.',
    startTime: new Date('2025-08-07T10:00:00Z'),
    endTime: new Date('2025-08-07T11:00:00Z'),
    attendees: [TEST_CONTACTS.ENGAGED_CLIENT.email],
    processed: false,
    extractedData: null,
    createdAt: new Date('2025-08-05'),
    updatedAt: new Date('2025-08-05')
  } satisfies CalendarEvent,

  CONSULTATION_CALL: {
    id: 'calendar-event-2',
    userId: TEST_USERS.WELLNESS_COACH.id,
    googleEventId: 'google-event-consultation-1',
    summary: 'Initial Consultation - Mike Chen',
    description: 'Discovery call to discuss wellness goals and program options.',
    startTime: new Date('2025-08-08T14:00:00Z'),
    endTime: new Date('2025-08-08T14:30:00Z'),
    attendees: [TEST_CONTACTS.NEW_CLIENT.email],
    processed: true,
    extractedData: {
      contactEmails: [TEST_CONTACTS.NEW_CLIENT.email],
      importance: 'high',
      category: 'consultation'
    },
    createdAt: new Date('2025-08-06'),
    updatedAt: new Date('2025-08-06')
  } satisfies CalendarEvent
} as const;

// Test AI suggestions
export const TEST_AI_SUGGESTIONS = {
  FOLLOW_UP_EMAIL: {
    id: 'suggestion-followup-1',
    userId: TEST_USERS.WELLNESS_COACH.id,
    type: 'follow_up',
    title: 'Follow up with Emily Rodriguez',
    description: 'Emily has not engaged in 2 weeks. Consider sending a check-in email.',
    priority: 'medium',
    status: 'pending',
    data: {
      contactId: TEST_CONTACTS.CURIOUS_PROSPECT.id,
      suggestedAction: 'send_email',
      template: 'check_in'
    },
    createdAt: new Date('2025-08-05'),
    updatedAt: new Date('2025-08-05'),
    reviewedAt: null,
    rejectionReason: null
  } satisfies AiSuggestion,

  SCHEDULE_SESSION: {
    id: 'suggestion-schedule-1',
    userId: TEST_USERS.WELLNESS_COACH.id,
    type: 'schedule',
    title: 'Schedule session with Sarah Johnson',
    description: 'Sarah requested to book her next meditation session.',
    priority: 'high',
    status: 'approved',
    data: {
      contactId: TEST_CONTACTS.ENGAGED_CLIENT.id,
      suggestedTime: '2025-08-10T10:00:00Z',
      sessionType: 'meditation'
    },
    createdAt: new Date('2025-08-04'),
    updatedAt: new Date('2025-08-05'),
    reviewedAt: new Date('2025-08-05'),
    rejectionReason: null
  } satisfies AiSuggestion
} as const;

// File upload test data
export const TEST_FILE_UPLOADS = {
  VALID_IMAGE: {
    fieldname: 'photo',
    originalname: 'profile.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: 1024 * 100, // 100KB
    destination: 'temp/',
    filename: 'test-photo-123.jpg',
    path: 'temp/test-photo-123.jpg'
  } as Express.Multer.File,

  LARGE_IMAGE: {
    fieldname: 'photo',
    originalname: 'large-photo.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: 1024 * 1024 * 10, // 10MB
    destination: 'temp/',
    filename: 'test-large-photo-456.jpg',
    path: 'temp/test-large-photo-456.jpg'
  } as Express.Multer.File,

  INVALID_FILE: {
    fieldname: 'photo',
    originalname: 'document.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: 1024 * 50, // 50KB
    destination: 'temp/',
    filename: 'test-document-789.pdf',
    path: 'temp/test-document-789.pdf'
  } as Express.Multer.File
} as const;

// Error scenarios for negative testing
export const ERROR_SCENARIOS = {
  DATABASE_ERROR: new Error('Database connection failed'),
  RATE_LIMIT_ERROR: new Error('Rate limit exceeded'),
  AI_SERVICE_ERROR: new Error('AI service unavailable'),
  GOOGLE_API_ERROR: new Error('Google API authentication failed'),
  FILE_UPLOAD_ERROR: new Error('File upload failed'),
  VALIDATION_ERROR: new Error('Invalid input data')
} as const;

// Performance testing data
export const PERFORMANCE_DATA = {
  LARGE_CONTACT_LIST: Array.from({ length: 1000 }, (_, i) => ({
    id: `perf-contact-${i}`,
    userId: TEST_USERS.WELLNESS_COACH.id,
    name: `Performance Test Contact ${i}`,
    email: `perf${i}@example.com`,
    phone: `+1-555-${String(i).padStart(4, '0')}`,
    lifecycleStage: 'new_client' as const,
    sentiment: Math.floor(Math.random() * 5) + 1,
    engagementTrend: 'stable' as const,
    hasGdprConsent: Math.random() > 0.3,
    createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
    updatedAt: new Date()
  } satisfies InsertContact)),

  BULK_CALENDAR_EVENTS: Array.from({ length: 500 }, (_, i) => ({
    id: `perf-event-${i}`,
    userId: TEST_USERS.WELLNESS_COACH.id,
    googleEventId: `google-perf-event-${i}`,
    summary: `Performance Test Event ${i}`,
    description: `Test event for performance testing - ${i}`,
    startTime: new Date(Date.now() + i * 60 * 60 * 1000),
    endTime: new Date(Date.now() + (i + 1) * 60 * 60 * 1000),
    attendees: [`perf${i % 100}@example.com`],
    processed: false,
    extractedData: null,
    createdAt: new Date(),
    updatedAt: new Date()
  } satisfies CalendarEvent))
} as const;

/**
 * Helper function to get a clean copy of test data
 */
export function getTestData<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

/**
 * Generate dynamic test data with variations
 */
export function generateTestContact(overrides: Partial<InsertContact> = {}): InsertContact {
  const timestamp = Date.now();
  return {
    id: `test-contact-${timestamp}`,
    userId: TEST_USERS.WELLNESS_COACH.id,
    name: `Test Contact ${timestamp}`,
    email: `test${timestamp}@example.com`,
    phone: `+1-555-${String(timestamp).slice(-4)}`,
    lifecycleStage: 'curious',
    sentiment: 3,
    engagementTrend: 'stable',
    hasGdprConsent: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  } as InsertContact;
}