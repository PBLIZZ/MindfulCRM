import { db } from '../../server/db.js';
import { 
  users, 
  contacts, 
  tags, 
  contactTags, 
  interactions, 
  calendarEvents,
  tasks,
  goals,
  aiSuggestions,
  documents,
  photos
} from '../../shared/schema.js';
import type { TestUser, TestContact, TestDataSeed } from '../../server/types/test-types.js';

/**
 * Set up test database - ensures clean state before tests
 */
export async function setupTestDatabase(): Promise<void> {
  // In a real implementation, you might want to create a separate test database
  // For now, we'll ensure the existing database is ready for testing
  console.log('🔧 Setting up test database...');
  
  // Verify all tables exist (this will throw if schema is broken)
  await db.select({ count: 1 }).from(users).limit(1);
  await db.select({ count: 1 }).from(contacts).limit(1);
  
  console.log('✅ Test database setup complete');
}

/**
 * Clean up test data after each test to ensure isolation
 */
export async function cleanupTestDatabase(): Promise<void> {
  try {
    // Delete in correct order to handle foreign key constraints
    await db.delete(photos);
    await db.delete(documents);
    await db.delete(aiSuggestions);
    await db.delete(goals);
    await db.delete(tasks);
    await db.delete(calendarEvents);
    await db.delete(interactions);
    await db.delete(contactTags);
    await db.delete(contacts);
    await db.delete(tags);
    await db.delete(users);
    
  } catch (error) {
    console.error('Error cleaning up test database:', error);
    throw error;
  }
}

/**
 * Create a test user with common properties
 */
export async function createTestUser(overrides: Partial<TestUser> = {}): Promise<TestUser> {
  const userData = {
    id: `test-user-${Date.now()}`,
    email: `test${Date.now()}@example.com`,
    name: 'Test User',
    googleId: `google-${Date.now()}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };

  const [user] = await db.insert(users).values(userData).returning();
  return user as TestUser;
}

/**
 * Create a test contact for a user
 */
export async function createTestContact(
  userId: string, 
  overrides: Partial<TestContact> = {}
): Promise<TestContact> {
  const contactData = {
    id: `test-contact-${Date.now()}`,
    userId,
    name: 'Test Contact',
    email: `contact${Date.now()}@example.com`,
    phone: '+1234567890',
    hasGdprConsent: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };

  const [contact] = await db.insert(contacts).values(contactData).returning();
  return contact as TestContact;
}

/**
 * Seed comprehensive test data for integration tests
 */
export async function seedTestData(): Promise<TestDataSeed> {
  const testUsers: TestUser[] = [];
  const testContacts: TestContact[] = [];
  const testTags: Array<{ id: string; name: string; color: string }> = [];
  const testInteractions: Array<{
    id: string;
    contactId: string;
    type: string;
    content: string;
    createdAt: Date;
  }> = [];

  // Create test user
  const user = await createTestUser({
    email: 'test.wellness.coach@example.com',
    name: 'Test Wellness Coach'
  });
  testUsers.push(user);

  // Create test tags
  const tagData = [
    { name: 'VIP Client', color: '#FFD700' },
    { name: 'New Member', color: '#32CD32' },
    { name: 'Needs Follow-up', color: '#FF6347' }
  ];

  for (const tag of tagData) {
    const [createdTag] = await db.insert(tags).values({
      id: `tag-${Date.now()}-${tag.name.replace(/\s+/g, '-').toLowerCase()}`,
      name: tag.name,
      color: tag.color,
      createdAt: new Date()
    }).returning();
    testTags.push(createdTag);
  }

  // Create test contacts
  const contactsData = [
    {
      name: 'Sarah Johnson',
      email: 'sarah.johnson@example.com',
      phone: '+1-555-0101',
      lifecycleStage: 'core_client' as const,
      sentiment: 5,
      engagementTrend: 'improving' as const
    },
    {
      name: 'Mike Chen',
      email: 'mike.chen@example.com',
      phone: '+1-555-0102',
      lifecycleStage: 'new_client' as const,
      sentiment: 4,
      engagementTrend: 'stable' as const
    },
    {
      name: 'Emily Rodriguez',
      email: 'emily.rodriguez@example.com',
      phone: '+1-555-0103',
      lifecycleStage: 'curious' as const,
      sentiment: 3,
      engagementTrend: 'declining' as const
    }
  ];

  for (const contactData of contactsData) {
    const contact = await createTestContact(user.id, contactData);
    testContacts.push(contact);

    // Add some tags to contacts
    if (testTags.length > 0) {
      const tagToAssign = testTags[Math.floor(Math.random() * testTags.length)];
      await db.insert(contactTags).values({
        contactId: contact.id,
        tagId: tagToAssign.id
      });
    }

    // Create test interactions
    const interactionData = {
      id: `interaction-${Date.now()}-${contact.id}`,
      contactId: contact.id,
      type: 'email',
      content: `Test interaction with ${contact.name}`,
      createdAt: new Date()
    };
    
    await db.insert(interactions).values({
      ...interactionData,
      userId: user.id,
      summary: interactionData.content,
      extractedFields: null,
      sentiment: contactData.sentiment,
      updatedAt: new Date()
    });
    
    testInteractions.push(interactionData);
  }

  // Create some test calendar events
  const calendarEventsData = [
    {
      userId: user.id,
      googleEventId: 'test-event-1',
      summary: 'Meditation Session with Sarah',
      description: 'Weekly meditation session focusing on mindfulness',
      startTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      endTime: new Date(Date.now() + 25 * 60 * 60 * 1000),
      attendees: ['sarah.johnson@example.com'],
      processed: false,
      extractedData: null,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  for (const eventData of calendarEventsData) {
    await db.insert(calendarEvents).values(eventData);
  }

  return {
    users: testUsers,
    contacts: testContacts,
    tags: testTags,
    interactions: testInteractions
  };
}

/**
 * Create a test context with user and contacts for tests
 */
export async function createTestContext(): Promise<{
  user: TestUser;
  contacts: TestContact[];
  cleanup: () => Promise<void>;
}> {
  const user = await createTestUser();
  const contacts = await Promise.all([
    createTestContact(user.id, { name: 'Alice Smith', email: 'alice@example.com' }),
    createTestContact(user.id, { name: 'Bob Johnson', email: 'bob@example.com' }),
    createTestContact(user.id, { name: 'Carol Williams', email: 'carol@example.com' })
  ]);

  return {
    user,
    contacts,
    cleanup: async () => {
      await cleanupTestDatabase();
    }
  };
}