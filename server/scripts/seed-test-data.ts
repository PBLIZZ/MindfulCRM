#!/usr/bin/env tsx

import dotenv from 'dotenv';
dotenv.config();

import { db } from '../db.js';
import { users, contacts, calendarEvents, interactions, goals } from '../../shared/schema.js';
import { eq } from 'drizzle-orm';

// Realistic wellness practitioner test data
const testUser = {
  googleId: 'test-google-id-12345',
  email: 'wellness.coach@example.com',
  name: 'Sarah Johnson',
  picture: 'https://example.com/avatar.jpg',
  accessToken: 'test-access-token',
  refreshToken: 'test-refresh-token',
};

const testContacts = [
  {
    name: 'Emily Chen',
    email: 'emily.chen@email.com',
    phone: '+1-555-0123',
    lifecycleStage: 'core_client' as const,
    status: 'active',
    notes: 'Regular yoga sessions, working on stress management',
  },
  {
    name: 'Michael Rodriguez',
    email: 'mike.rodriguez@email.com',
    phone: '+1-555-0124',
    lifecycleStage: 'new_client' as const,
    status: 'active',
    notes: 'New client, interested in mindfulness coaching',
  },
  {
    name: 'Jessica Williams',
    email: 'jessica.williams@email.com',
    phone: '+1-555-0125',
    lifecycleStage: 'needs_reconnecting' as const,
    status: 'active',
    notes: 'Missed last few sessions, may need follow-up',
  },
  {
    name: 'David Kim',
    email: 'david.kim@email.com',
    phone: '+1-555-0126',
    lifecycleStage: 'curious' as const,
    status: 'active',
    notes: 'Interested in meditation programs',
  },
  {
    name: 'Amanda Foster',
    email: 'amanda.foster@email.com',
    phone: '+1-555-0127',
    lifecycleStage: 'ambassador' as const,
    status: 'active',
    notes: 'Long-term client, refers others regularly',
  },
];

// Realistic calendar events that would come from Google Calendar sync
const getCalendarEvents = (userId: string, contactIds: string[]) => [
  {
    userId,
    googleEventId: 'event_001_' + Date.now(),
    summary: '1:1 Wellness Session - Emily Chen',
    description:
      'Weekly wellness session focusing on stress reduction techniques and mindfulness practices. Emily mentioned feeling overwhelmed at work this week.',
    startTime: new Date('2025-01-28T10:00:00Z'),
    endTime: new Date('2025-01-28T11:00:00Z'),
    location: 'Wellness Center - Room 2',
    meetingType: 'in-person',
    attendees: [{ email: 'emily.chen@email.com', name: 'Emily Chen' }],
    calendarId: 'primary',
    calendarName: 'Business',
    calendarColor: '#3174ad',
    processed: false,
    rawData: {
      kind: 'calendar#event',
      etag: '"test_etag_001"',
      id: 'event_001_' + Date.now(),
      status: 'confirmed',
      created: '2025-01-20T12:00:00.000Z',
      updated: '2025-01-20T12:00:00.000Z',
      summary: '1:1 Wellness Session - Emily Chen',
      description:
        'Weekly wellness session focusing on stress reduction techniques and mindfulness practices. Emily mentioned feeling overwhelmed at work this week.',
      location: 'Wellness Center - Room 2',
      creator: { email: 'wellness.coach@example.com' },
      organizer: { email: 'wellness.coach@example.com' },
      start: { dateTime: '2025-01-28T10:00:00Z', timeZone: 'America/New_York' },
      end: { dateTime: '2025-01-28T11:00:00Z', timeZone: 'America/New_York' },
      attendees: [
        { email: 'wellness.coach@example.com', responseStatus: 'accepted' },
        { email: 'emily.chen@email.com', responseStatus: 'accepted' },
      ],
    },
  },
  {
    userId,
    googleEventId: 'event_002_' + Date.now(),
    summary: 'Initial Consultation - Michael Rodriguez',
    description:
      'First consultation with new client Michael. Discussed goals: reducing anxiety, improving sleep quality, building healthy morning routine.',
    startTime: new Date('2025-01-29T14:00:00Z'),
    endTime: new Date('2025-01-29T15:30:00Z'),
    location: 'Virtual - Zoom',
    meetingType: 'video',
    attendees: [{ email: 'mike.rodriguez@email.com', name: 'Michael Rodriguez' }],
    calendarId: 'primary',
    calendarName: 'Business',
    calendarColor: '#3174ad',
    processed: false,
    rawData: {
      kind: 'calendar#event',
      etag: '"test_etag_002"',
      id: 'event_002_' + Date.now(),
      status: 'confirmed',
      created: '2025-01-22T09:00:00.000Z',
      updated: '2025-01-22T09:00:00.000Z',
      summary: 'Initial Consultation - Michael Rodriguez',
      description:
        'First consultation with new client Michael. Discussed goals: reducing anxiety, improving sleep quality, building healthy morning routine.',
      location: 'Virtual - Zoom',
      creator: { email: 'wellness.coach@example.com' },
      organizer: { email: 'wellness.coach@example.com' },
      start: { dateTime: '2025-01-29T14:00:00Z', timeZone: 'America/New_York' },
      end: { dateTime: '2025-01-29T15:30:00Z', timeZone: 'America/New_York' },
      attendees: [
        { email: 'wellness.coach@example.com', responseStatus: 'accepted' },
        { email: 'mike.rodriguez@email.com', responseStatus: 'accepted' },
      ],
    },
  },
  {
    userId,
    googleEventId: 'event_003_' + Date.now(),
    summary: 'Follow-up Call - Jessica Williams',
    description:
      'Check-in call with Jessica who has missed recent sessions. Want to understand any challenges and see how to better support her wellness journey.',
    startTime: new Date('2025-01-30T16:00:00Z'),
    endTime: new Date('2025-01-30T16:30:00Z'),
    location: 'Phone call',
    meetingType: 'phone',
    attendees: [{ email: 'jessica.williams@email.com', name: 'Jessica Williams' }],
    calendarId: 'primary',
    calendarName: 'Business',
    calendarColor: '#3174ad',
    processed: false,
    rawData: {
      kind: 'calendar#event',
      etag: '"test_etag_003"',
      id: 'event_003_' + Date.now(),
      status: 'confirmed',
      created: '2025-01-25T11:00:00.000Z',
      updated: '2025-01-25T11:00:00.000Z',
      summary: 'Follow-up Call - Jessica Williams',
      description:
        'Check-in call with Jessica who has missed recent sessions. Want to understand any challenges and see how to better support her wellness journey.',
    },
  },
  {
    userId,
    googleEventId: 'event_004_' + Date.now(),
    summary: 'Group Meditation Session',
    description:
      'Weekly group meditation session. Focus on breath work and body awareness. Expecting 8-10 participants.',
    startTime: new Date('2025-01-31T18:00:00Z'),
    endTime: new Date('2025-01-31T19:00:00Z'),
    location: 'Wellness Center - Main Hall',
    meetingType: 'in-person',
    attendees: [
      { email: 'emily.chen@email.com', name: 'Emily Chen' },
      { email: 'david.kim@email.com', name: 'David Kim' },
      { email: 'amanda.foster@email.com', name: 'Amanda Foster' },
    ],
    calendarId: 'primary',
    calendarName: 'Business',
    calendarColor: '#3174ad',
    processed: false,
    rawData: {
      kind: 'calendar#event',
      etag: '"test_etag_004"',
      id: 'event_004_' + Date.now(),
      status: 'confirmed',
      created: '2025-01-15T10:00:00.000Z',
      updated: '2025-01-15T10:00:00.000Z',
      summary: 'Group Meditation Session',
      description:
        'Weekly group meditation session. Focus on breath work and body awareness. Expecting 8-10 participants.',
      location: 'Wellness Center - Main Hall',
      recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=FR'],
    },
  },
  {
    userId,
    googleEventId: 'event_005_' + Date.now(),
    summary: 'Administrative Time - Client Notes',
    description:
      'Time blocked for updating client notes, treatment plans, and preparing for upcoming sessions.',
    startTime: new Date('2025-02-01T09:00:00Z'),
    endTime: new Date('2025-02-01T10:00:00Z'),
    location: 'Home Office',
    meetingType: 'other',
    attendees: [],
    calendarId: 'primary',
    calendarName: 'Business',
    calendarColor: '#3174ad',
    processed: false,
    rawData: {
      kind: 'calendar#event',
      etag: '"test_etag_005"',
      id: 'event_005_' + Date.now(),
      status: 'confirmed',
      created: '2025-01-28T08:00:00.000Z',
      updated: '2025-01-28T08:00:00.000Z',
      summary: 'Administrative Time - Client Notes',
    },
  },
  {
    userId,
    googleEventId: 'event_006_' + Date.now(),
    summary: 'Personal: Yoga Class',
    description:
      'My own yoga practice at the local studio. Important for maintaining my own wellness.',
    startTime: new Date('2025-02-01T07:00:00Z'),
    endTime: new Date('2025-02-01T08:00:00Z'),
    location: 'Downtown Yoga Studio',
    meetingType: 'in-person',
    attendees: [],
    calendarId: 'personal',
    calendarName: 'Personal',
    calendarColor: '#42d692',
    processed: false,
    rawData: {
      kind: 'calendar#event',
      etag: '"test_etag_006"',
      id: 'event_006_' + Date.now(),
      status: 'confirmed',
      created: '2025-01-20T20:00:00.000Z',
      updated: '2025-01-20T20:00:00.000Z',
      summary: 'Personal: Yoga Class',
    },
  },
];

// Sample email interactions that would come from Gmail sync
const getEmailInteractions = (contactIds: { [email: string]: string }) => [
  {
    contactId: contactIds['emily.chen@email.com'],
    type: 'email',
    subject: "Re: This week's session",
    content:
      "Hi Sarah, Thank you for today's session. The breathing techniques you showed me really helped when I had that stressful meeting yesterday. I've been practicing them daily. Looking forward to our session next week! Best, Emily",
    timestamp: new Date('2025-01-28T15:30:00Z'),
    source: 'gmail',
    sourceId: 'gmail_msg_001_' + Date.now(),
    sentiment: 4,
  },
  {
    contactId: contactIds['mike.rodriguez@email.com'],
    type: 'email',
    subject: 'Questions before our consultation',
    content:
      "Hi Sarah, I'm excited about our consultation tomorrow. I wanted to ask - should I prepare anything specific? Also, I've been having trouble sleeping lately (2-3 hours per night) and my anxiety levels are quite high. I'm hoping we can work on this together. Thanks, Michael",
    timestamp: new Date('2025-01-28T20:00:00Z'),
    source: 'gmail',
    sourceId: 'gmail_msg_002_' + Date.now(),
    sentiment: 2,
  },
  {
    contactId: contactIds['jessica.williams@email.com'],
    type: 'email',
    subject: 'Sorry I missed our session',
    content:
      "Sarah, I'm really sorry I had to cancel our last two sessions. Work has been absolutely crazy and I've been traveling a lot. I know consistency is important for my wellness journey but I'm struggling to balance everything. Can we talk about this in our call tomorrow? I don't want to give up on this. Jessica",
    timestamp: new Date('2025-01-29T22:00:00Z'),
    source: 'gmail',
    sourceId: 'gmail_msg_003_' + Date.now(),
    sentiment: 2,
  },
  {
    contactId: contactIds['david.kim@email.com'],
    type: 'email',
    subject: 'Meditation program inquiry',
    content:
      "Hello Sarah, I attended your group meditation session last Friday and found it incredibly peaceful. I'm interested in learning more about your individual meditation coaching programs. Could we schedule a time to discuss? I'm particularly interested in techniques for focus and productivity. Thanks, David",
    timestamp: new Date('2025-01-26T10:00:00Z'),
    source: 'gmail',
    sourceId: 'gmail_msg_004_' + Date.now(),
    sentiment: 4,
  },
  {
    contactId: contactIds['amanda.foster@email.com'],
    type: 'email',
    subject: 'Thank you + referral',
    content:
      "Sarah, I can't thank you enough for the transformation I've experienced over the past year. My stress levels are at an all-time low and I feel more centered than ever. I've referred my colleague Lisa Martinez (lisa.martinez@company.com) to you - she's dealing with burnout and I think your approach would really help her. She'll be reaching out soon. Gratefully, Amanda",
    timestamp: new Date('2025-01-27T14:20:00Z'),
    source: 'gmail',
    sourceId: 'gmail_msg_005_' + Date.now(),
    sentiment: 5,
  },
];

// Sample wellness goals
const getGoals = (contactIds: { [email: string]: string }) => [
  {
    contactId: contactIds['emily.chen@email.com'],
    title: 'Daily Meditation Practice',
    description: 'Establish consistent daily meditation practice of at least 10 minutes',
    targetValue: 30,
    currentValue: 18,
    unit: 'days',
    status: 'active',
    deadline: new Date('2025-03-01T00:00:00Z'),
  },
  {
    contactId: contactIds['mike.rodriguez@email.com'],
    title: 'Improve Sleep Quality',
    description: 'Achieve 7-8 hours of quality sleep per night using relaxation techniques',
    targetValue: 8,
    currentValue: 4,
    unit: 'hours',
    status: 'active',
    deadline: new Date('2025-04-01T00:00:00Z'),
  },
  {
    contactId: contactIds['jessica.williams@email.com'],
    title: 'Weekly Session Attendance',
    description: 'Attend weekly wellness sessions consistently',
    targetValue: 4,
    currentValue: 1,
    unit: 'sessions',
    status: 'active',
    deadline: new Date('2025-02-28T00:00:00Z'),
  },
];

export async function seedTestData() {
  console.log('🌱 Starting seed data insertion...');

  try {
    // Clean up existing test data
    console.log('🧹 Cleaning up existing test data...');
    await db.delete(interactions).where(eq(interactions.source, 'gmail'));
    await db.delete(calendarEvents).where(eq(calendarEvents.googleEventId, 'test'));
    await db.delete(goals);
    await db.delete(contacts).where(eq(contacts.email, 'emily.chen@email.com'));
    await db.delete(users).where(eq(users.email, testUser.email));

    // Insert test user
    console.log('👤 Creating test user...');
    const [user] = await db.insert(users).values(testUser).returning();

    // Insert test contacts
    console.log('👥 Creating test contacts...');
    const insertedContacts = await db
      .insert(contacts)
      .values(testContacts.map((contact) => ({ ...contact, userId: user.id })))
      .returning();

    // Create contact email to ID mapping
    const contactEmailToId: { [email: string]: string } = {};
    insertedContacts.forEach((contact) => {
      contactEmailToId[contact.email] = contact.id;
    });

    // Insert calendar events
    console.log('📅 Creating calendar events...');
    const calendarEventData = getCalendarEvents(
      user.id,
      insertedContacts.map((c) => c.id)
    );
    await db.insert(calendarEvents).values(calendarEventData);

    // Insert email interactions
    console.log('📧 Creating email interactions...');
    const emailInteractionData = getEmailInteractions(contactEmailToId);
    await db.insert(interactions).values(emailInteractionData);

    // Insert goals
    console.log('🎯 Creating wellness goals...');
    const goalData = getGoals(contactEmailToId);
    await db.insert(goals).values(goalData);

    console.log('✅ Seed data insertion completed successfully!');
    console.log(`📊 Created:`);
    console.log(`   • 1 test user (${user.email})`);
    console.log(`   • ${insertedContacts.length} contacts`);
    console.log(`   • ${calendarEventData.length} calendar events`);
    console.log(`   • ${emailInteractionData.length} email interactions`);
    console.log(`   • ${goalData.length} wellness goals`);

    return {
      user,
      contacts: insertedContacts,
      success: true,
    };
  } catch (error) {
    console.error('❌ Error seeding test data:', error);
    throw error;
  }
}

// Allow running as script
if (require.main === module) {
  seedTestData()
    .then(() => {
      console.log('✨ Test data seeding complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Seeding failed:', error);
      process.exit(1);
    });
}
