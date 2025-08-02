#!/usr/bin/env tsx

import dotenv from 'dotenv';
dotenv.config();

import { db } from './db';
import {
  users,
  contacts,
  calendarEvents,
  interactions,
  lifecycleStageEnum,
  type InsertUser,
  type InsertContact,
  type InsertCalendarEvent,
  type InsertInteraction,
} from '@shared/schema';
import { eq } from 'drizzle-orm';

// Test user data
const testUser: InsertUser = {
  googleId: 'test-google-id-12345',
  email: 'wellness.coach@example.com',
  name: 'Dr. Sarah Thompson',
  picture: 'https://example.com/avatar.jpg',
  accessToken: 'test-access-token',
  refreshToken: 'test-refresh-token',
};

// Realistic client contacts
const testContacts: Omit<InsertContact, 'userId'>[] = [
  {
    name: 'Emma Rodriguez',
    email: 'emma.rodriguez@email.com',
    phone: '+1-555-0123',
    lifecycleStage: 'core_client',
    status: 'active',
    sentiment: 4,
    engagementTrend: 'improving',
    notes: 'Making excellent progress with anxiety management. Very engaged.',
    lastContact: new Date('2025-01-30T10:00:00Z'),
    referralCount: 2,
  },
  {
    name: 'Michael Chen',
    email: 'michael.chen@techcorp.com',
    phone: '+1-555-0124',
    lifecycleStage: 'new_client',
    status: 'active',
    sentiment: 3,
    engagementTrend: 'stable',
    notes: 'Recently started stress management program. Works in tech.',
    lastContact: new Date('2025-01-29T14:30:00Z'),
    referralCount: 0,
  },
  {
    name: 'Lisa Williams',
    email: 'lisa.williams@gmail.com',
    phone: '+1-555-0125',
    lifecycleStage: 'needs_reconnecting',
    status: 'active',
    sentiment: 2,
    engagementTrend: 'declining',
    notes: 'Missed last two appointments. Going through difficult time.',
    lastContact: new Date('2025-01-15T09:00:00Z'),
    referralCount: 1,
  },
  {
    name: 'James Parker',
    email: 'james.parker@consulting.biz',
    phone: '+1-555-0126',
    lifecycleStage: 'ambassador',
    status: 'active',
    sentiment: 5,
    engagementTrend: 'improving',
    notes: 'Transformation success story. Refers many clients.',
    lastContact: new Date('2025-01-28T16:00:00Z'),
    referralCount: 5,
  },
  {
    name: 'Rachel Davis',
    email: 'rachel.davis@university.edu',
    phone: '+1-555-0127',
    lifecycleStage: 'curious',
    status: 'active',
    sentiment: 3,
    engagementTrend: 'stable',
    notes: 'Professor interested in mindfulness program. Scheduling consultation.',
    lastContact: new Date('2025-01-31T11:00:00Z'),
    referralCount: 0,
  },
];

// Generate realistic calendar events that would come from Google Calendar sync
function generateCalendarEvents(userId: string, contactEmails: string[]): Omit<InsertCalendarEvent, 'userId'>[] {
  const events: Omit<InsertCalendarEvent, 'userId'>[] = [];
  const now = new Date();
  
  // Client session events
  events.push({
    googleEventId: 'event-001-emma-session',
    summary: 'Emma Rodriguez - Anxiety Management Session',
    description: 'Weekly session focusing on breathing techniques and cognitive restructuring. Emma has been making great progress with her social anxiety.',
    startTime: new Date('2025-02-03T10:00:00Z'),
    endTime: new Date('2025-02-03T11:00:00Z'),
    location: 'Wellness Center - Room 2',
    meetingType: 'in-person',
    attendees: [{ email: 'emma.rodriguez@email.com', name: 'Emma Rodriguez' }],
    calendarId: 'primary',
    calendarName: 'Business Calendar',
    processed: false,
    rawData: {
      id: 'event-001-emma-session',
      summary: 'Emma Rodriguez - Anxiety Management Session',
      description: 'Weekly session focusing on breathing techniques and cognitive restructuring. Emma has been making great progress with her social anxiety.',
      start: { dateTime: '2025-02-03T10:00:00Z' },
      end: { dateTime: '2025-02-03T11:00:00Z' },
      location: 'Wellness Center - Room 2',
      attendees: [{ email: 'emma.rodriguez@email.com', displayName: 'Emma Rodriguez' }],
    },
  });

  events.push({
    googleEventId: 'event-002-michael-consultation',
    summary: 'Michael Chen - Initial Consultation',
    description: 'First consultation to assess stress levels and develop personalized wellness plan. Michael mentioned high work pressure and burnout symptoms.',
    startTime: new Date('2025-02-04T14:30:00Z'),
    endTime: new Date('2025-02-04T15:30:00Z'),
    location: 'Virtual - Zoom',
    meetingType: 'video',
    attendees: [{ email: 'michael.chen@techcorp.com', name: 'Michael Chen' }],
    calendarId: 'primary',
    calendarName: 'Business Calendar',
    processed: false,
    rawData: {
      id: 'event-002-michael-consultation',
      summary: 'Michael Chen - Initial Consultation',
      description: 'First consultation to assess stress levels and develop personalized wellness plan. Michael mentioned high work pressure and burnout symptoms.',
      start: { dateTime: '2025-02-04T14:30:00Z' },
      end: { dateTime: '2025-02-04T15:30:00Z' },
      location: 'Virtual - Zoom',
      attendees: [{ email: 'michael.chen@techcorp.com', displayName: 'Michael Chen' }],
    },
  });

  events.push({
    googleEventId: 'event-003-lisa-followup',
    summary: 'Lisa Williams - Check-in Call',
    description: 'Follow-up call to check on Lisa after missed appointments. Concerned about her recent challenges and want to offer support.',
    startTime: new Date('2025-02-05T09:00:00Z'),
    endTime: new Date('2025-02-05T09:30:00Z'),
    location: 'Phone Call',
    meetingType: 'phone',
    attendees: [{ email: 'lisa.williams@gmail.com', name: 'Lisa Williams' }],
    calendarId: 'primary',
    calendarName: 'Business Calendar',
    processed: false,
    rawData: {
      id: 'event-003-lisa-followup',
      summary: 'Lisa Williams - Check-in Call',
      description: 'Follow-up call to check on Lisa after missed appointments. Concerned about her recent challenges and want to offer support.',
      start: { dateTime: '2025-02-05T09:00:00Z' },
      end: { dateTime: '2025-02-05T09:30:00Z' },
      location: 'Phone Call',
      attendees: [{ email: 'lisa.williams@gmail.com', displayName: 'Lisa Williams' }],
    },
  });

  events.push({
    googleEventId: 'event-004-group-mindfulness',
    summary: 'Mindfulness Workshop - Group Session',
    description: 'Monthly group mindfulness workshop. Focus on meditation techniques and stress reduction. Regular attendees include James and Rachel.',
    startTime: new Date('2025-02-06T18:00:00Z'),
    endTime: new Date('2025-02-06T19:30:00Z'),
    location: 'Community Center - Main Hall',
    meetingType: 'in-person',
    attendees: [
      { email: 'james.parker@consulting.biz', name: 'James Parker' },
      { email: 'rachel.davis@university.edu', name: 'Rachel Davis' },
      { email: 'participant1@example.com', name: 'Workshop Participant' },
    ],
    calendarId: 'primary',
    calendarName: 'Business Calendar',
    processed: false,
    rawData: {
      id: 'event-004-group-mindfulness',
      summary: 'Mindfulness Workshop - Group Session',
      description: 'Monthly group mindfulness workshop. Focus on meditation techniques and stress reduction. Regular attendees include James and Rachel.',
      start: { dateTime: '2025-02-06T18:00:00Z' },
      end: { dateTime: '2025-02-06T19:30:00Z' },
      location: 'Community Center - Main Hall',
      attendees: [
        { email: 'james.parker@consulting.biz', displayName: 'James Parker' },
        { email: 'rachel.davis@university.edu', displayName: 'Rachel Davis' },
        { email: 'participant1@example.com', displayName: 'Workshop Participant' },
      ],
    },
  });

  // Personal/admin events to test filtering
  events.push({
    googleEventId: 'event-005-personal-appointment',
    summary: 'Doctor Appointment',
    description: 'Personal medical checkup',
    startTime: new Date('2025-02-07T10:00:00Z'),
    endTime: new Date('2025-02-07T11:00:00Z'),
    location: 'Medical Center',
    meetingType: 'in-person',
    attendees: [],
    calendarId: 'personal',
    calendarName: 'Personal',
    processed: false,
    rawData: {
      id: 'event-005-personal-appointment',
      summary: 'Doctor Appointment',
      description: 'Personal medical checkup',
      start: { dateTime: '2025-02-07T10:00:00Z' },
      end: { dateTime: '2025-02-07T11:00:00Z' },
      location: 'Medical Center',
    },
  });

  events.push({
    googleEventId: 'event-006-admin-planning',
    summary: 'Business Planning Session',
    description: 'Monthly business review and planning. Review client progress, update programs, and plan marketing activities.',
    startTime: new Date('2025-02-08T09:00:00Z'),
    endTime: new Date('2025-02-08T11:00:00Z'),
    location: 'Home Office',
    meetingType: 'in-person',
    attendees: [],
    calendarId: 'primary',
    calendarName: 'Business Calendar',
    processed: false,
    rawData: {
      id: 'event-006-admin-planning',
      summary: 'Business Planning Session',
      description: 'Monthly business review and planning. Review client progress, update programs, and plan marketing activities.',
      start: { dateTime: '2025-02-08T09:00:00Z' },
      end: { dateTime: '2025-02-08T11:00:00Z' },
      location: 'Home Office',
    },
  });

  return events;
}

// Generate email-like interactions that would come from Gmail sync
function generateInteractions(contactIds: { id: string; email: string }[]): Omit<InsertInteraction, 'contactId'>[] {
  const interactions: Omit<InsertInteraction, 'contactId'>[] = [];

  // Emma's interactions - positive progress
  const emmaContact = contactIds.find(c => c.email === 'emma.rodriguez@email.com');
  if (emmaContact) {
    interactions.push({
      type: 'email',
      subject: 'Thank you for today\'s session!',
      content: 'Hi Dr. Thompson, I wanted to thank you for today\'s session. The breathing exercises you taught me really helped during my presentation at work yesterday. I\'m feeling much more confident about managing my anxiety. Looking forward to our next session!',
      timestamp: new Date('2025-01-30T15:30:00Z'),
      source: 'gmail',
      sourceId: 'gmail-msg-001',
      sentiment: 5,
    });
  }

  // Michael's interaction - neutral/concerned
  const michaelContact = contactIds.find(c => c.email === 'michael.chen@techcorp.com');
  if (michaelContact) {
    interactions.push({
      type: 'email',
      subject: 'Question about stress management techniques',
      content: 'Dr. Thompson, I\'ve been trying the mindfulness exercises you suggested, but I\'m finding it hard to focus during meditation. My mind keeps racing about work deadlines. Is this normal? Should I be worried that it\'s not working for me?',
      timestamp: new Date('2025-01-29T20:45:00Z'),
      source: 'gmail',
      sourceId: 'gmail-msg-002',
      sentiment: 2,
    });
  }

  // Lisa's interaction - concerning
  const lisaContact = contactIds.find(c => c.email === 'lisa.williams@gmail.com');
  if (lisaContact) {
    interactions.push({
      type: 'email',
      subject: 'Sorry for missing appointments',
      content: 'Dr. Thompson, I\'m really sorry for missing our last two sessions. Things have been incredibly difficult at home - my mom was diagnosed with dementia and I\'ve been overwhelmed trying to coordinate her care while working full time. I know I need the support now more than ever, but I just can\'t seem to manage everything.',
      timestamp: new Date('2025-01-15T22:15:00Z'),
      source: 'gmail',
      sourceId: 'gmail-msg-003',
      sentiment: 1,
    });
  }

  // James's interaction - very positive
  const jamesContact = contactIds.find(c => c.email === 'james.parker@consulting.biz');
  if (jamesContact) {
    interactions.push({
      type: 'email',
      subject: 'Amazing transformation - thank you!',
      content: 'Dr. Thompson, I can\'t thank you enough for the incredible journey we\'ve been on together. Six months ago I was burned out, anxious, and frankly miserable. Today I gave a presentation to 200 people and felt completely at peace. My wife says I\'m like a different person. I\'ve already referred three colleagues to you - they desperately need what you offer.',
      timestamp: new Date('2025-01-28T19:00:00Z'),
      source: 'gmail',
      sourceId: 'gmail-msg-004',
      sentiment: 5,
    });
  }

  // Rachel's interaction - curious but hesitant
  const rachelContact = contactIds.find(c => c.email === 'rachel.davis@university.edu');
  if (rachelContact) {
    interactions.push({
      type: 'email',
      subject: 'Questions about your mindfulness program',
      content: 'Dr. Thompson, James Parker recommended your services. As a psychology professor, I\'m familiar with mindfulness research but have never tried it personally. I\'m dealing with academic stress and would like to learn more about your approach. Do you offer any programs specifically for academics? What would be involved in getting started?',
      timestamp: new Date('2025-01-31T14:20:00Z'),
      source: 'gmail',
      sourceId: 'gmail-msg-005',
      sentiment: 3,
    });
  }

  return interactions;
}

async function seedTestData() {
  console.log('🌱 Starting test data seeding...');

  try {
    // Check if test user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, testUser.email))
      .limit(1);

    let user;
    if (existingUser.length === 0) {
      console.log('Creating test user...');
      const [newUser] = await db.insert(users).values(testUser).returning();
      user = newUser;
    } else {
      console.log('Test user already exists, using existing user');
      user = existingUser[0];
    }

    // Clear existing test data for this user
    console.log('Clearing existing test data...');
    // Get all contacts for this user first
    const existingContacts = await db.select({ id: contacts.id }).from(contacts).where(eq(contacts.userId, user.id));
    
    // Delete interactions first (they reference contacts)
    for (const contact of existingContacts) {
      await db.delete(interactions).where(eq(interactions.contactId, contact.id));
    }
    
    // Then delete calendar events and contacts
    await db.delete(calendarEvents).where(eq(calendarEvents.userId, user.id));
    await db.delete(contacts).where(eq(contacts.userId, user.id));

    // Insert test contacts
    console.log('Creating test contacts...');
    const contactsWithUserId = testContacts.map(contact => ({
      ...contact,
      userId: user.id,
    }));
    
    const insertedContacts = await db
      .insert(contacts)
      .values(contactsWithUserId)
      .returning({ id: contacts.id, email: contacts.email });

    console.log(`Created ${insertedContacts.length} contacts`);

    // Insert calendar events
    console.log('Creating calendar events...');
    const contactEmails = insertedContacts.map(c => c.email);
    const calendarEventsData = generateCalendarEvents(user.id, contactEmails).map(event => ({
      ...event,
      userId: user.id,
    }));
    
    await db.insert(calendarEvents).values(calendarEventsData);
    console.log(`Created ${calendarEventsData.length} calendar events`);

    // Insert interactions
    console.log('Creating interactions...');
    const interactionsData = generateInteractions(insertedContacts);
    
    for (const interaction of interactionsData) {
      const contact = insertedContacts.find(c => {
        // Find contact by checking which interactions belong to which contact
        // This is a simple mapping - in real implementation you'd have proper relations
        return true; // We'll assign based on order for simplicity
      });
      
      if (contact) {
        await db.insert(interactions).values({
          ...interaction,
          contactId: contact.id,
        });
      }
    }

    // Assign interactions to contacts properly
    const allInteractions = generateInteractions(insertedContacts);
    for (let i = 0; i < allInteractions.length && i < insertedContacts.length; i++) {
      await db.insert(interactions).values({
        ...allInteractions[i],
        contactId: insertedContacts[i].id,
      });
    }

    console.log(`Created ${allInteractions.length} interactions`);

    console.log('✅ Test data seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`- User: ${user.email}`);
    console.log(`- Contacts: ${insertedContacts.length}`);
    console.log(`- Calendar Events: ${calendarEventsData.length}`);
    console.log(`- Interactions: ${allInteractions.length}`);
    console.log('\n🤖 Ready to test LLM processing!');
    console.log('\nNext steps:');
    console.log('1. Run the LLM processor to analyze calendar events');
    console.log('2. Check the frontend to see processed insights');
    console.log('3. Test OpenRouter/Gemini integration');

  } catch (error) {
    console.error('❌ Error seeding test data:', error);
    throw error;
  }
}

// Check if this file is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedTestData()
    .then(() => {
      console.log('Seeding completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seeding failed:', error);
      process.exit(1);
    });
}

export { seedTestData };
