#!/usr/bin/env tsx

import dotenv from 'dotenv';
import { db } from '../server/db.js';
import * as schema from '../shared/schema.js';
import { eq } from 'drizzle-orm';

dotenv.config();

// Test user info - replace with your actual Google account
const TEST_USER_EMAIL = 'peterjamesblizzard@gmail.com';
const TEST_USER_GOOGLE_ID = 'test-google-id-123';

// Sample wellness client data
const SAMPLE_CLIENTS = [
  {
    name: 'Sarah Johnson',
    email: 'sarah.johnson@example.com',
    phone: '+1-555-0101',
    lifecycleStage: 'core_client' as const,
    notes: 'Long-term client focused on stress management and work-life balance. Responds well to mindfulness techniques.',
  },
  {
    name: 'Michael Chen',
    email: 'michael.chen@example.com', 
    phone: '+1-555-0102',
    lifecycleStage: 'new_client' as const,
    notes: 'Recently started wellness journey. Interested in nutrition and fitness coaching.',
  },
  {
    name: 'Emily Rodriguez',
    email: 'emily.rodriguez@example.com',
    phone: '+1-555-0103', 
    lifecycleStage: 'curious' as const,
    notes: 'Exploring wellness options. Had initial consultation, considering package options.',
  },
  {
    name: 'David Thompson',
    email: 'david.thompson@example.com',
    phone: '+1-555-0104',
    lifecycleStage: 'needs_reconnecting' as const,
    notes: 'Former regular client who has been inactive for 3 months. Last session was focused on anxiety management.',
  },
  {
    name: 'Lisa Wang',
    email: 'lisa.wang@example.com',
    phone: '+1-555-0105',
    lifecycleStage: 'ambassador' as const,
    notes: 'Excellent progress with meditation practice. Has referred 3 new clients. Very engaged and positive.',
  },
];

// Sample calendar events that would come from Google Calendar sync
const SAMPLE_CALENDAR_EVENTS = [
  {
    googleEventId: 'wellness-session-001',
    summary: 'Wellness Coaching Session - Sarah Johnson',
    description: 'Weekly check-in session focusing on stress management techniques and mindfulness practice. Sarah mentioned feeling overwhelmed at work this week.',
    startTime: new Date('2024-01-15T10:00:00Z'),
    endTime: new Date('2024-01-15T11:00:00Z'),
    attendees: [{ email: 'sarah.johnson@example.com', name: 'Sarah Johnson' }],
    location: 'Wellness Studio - Room 1',
    meetingType: 'in-person',
  },
  {
    googleEventId: 'consultation-002', 
    summary: 'Initial Consultation - Michael Chen',
    description: 'First meeting with potential new client. Interested in nutrition coaching and fitness guidance. Discussed goals and created preliminary wellness plan.',
    startTime: new Date('2024-01-16T14:00:00Z'),
    endTime: new Date('2024-01-16T15:30:00Z'),
    attendees: [{ email: 'michael.chen@example.com', name: 'Michael Chen' }],
    location: 'Virtual - Zoom',
    meetingType: 'video',
  },
  {
    googleEventId: 'follow-up-003',
    summary: 'Follow-up Session - Emily Rodriguez',
    description: 'Second consultation to discuss wellness package options. Emily expressed interest in the 3-month mindfulness program.',
    startTime: new Date('2024-01-17T09:00:00Z'),
    endTime: new Date('2024-01-17T10:00:00Z'),
    attendees: [{ email: 'emily.rodriguez@example.com', name: 'Emily Rodriguez' }],
    location: 'Phone Call',
    meetingType: 'phone',
  },
  {
    googleEventId: 'group-session-004',
    summary: 'Group Meditation Workshop',
    description: 'Monthly group meditation session. Focus on breathing techniques and stress relief. Great energy from the group today!',
    startTime: new Date('2024-01-18T18:00:00Z'),
    endTime: new Date('2024-01-18T19:30:00Z'),
    attendees: [
      { email: 'sarah.johnson@example.com', name: 'Sarah Johnson' },
      { email: 'lisa.wang@example.com', name: 'Lisa Wang' },
      { email: 'group.participant1@example.com', name: 'Alex Smith' },
      { email: 'group.participant2@example.com', name: 'Maya Patel' },
    ],
    location: 'Wellness Studio - Main Room',
    meetingType: 'in-person',
  },
  {
    googleEventId: 'crisis-session-005',
    summary: 'Urgent Check-in - David Thompson',
    description: 'Emergency session requested by David. Experiencing high anxiety levels and panic attacks. Focused on immediate coping strategies and breathing exercises.',
    startTime: new Date('2024-01-19T16:00:00Z'),
    endTime: new Date('2024-01-19T17:00:00Z'),
    attendees: [{ email: 'david.thompson@example.com', name: 'David Thompson' }],
    location: 'Virtual - Emergency Session',
    meetingType: 'video',
  },
  {
    googleEventId: 'celebration-006',
    summary: 'Progress Celebration - Lisa Wang',
    description: 'Celebrating Lisa\'s 6-month meditation milestone! She\'s made incredible progress and wants to discuss becoming a wellness ambassador.',
    startTime: new Date('2024-01-20T11:00:00Z'),
    endTime: new Date('2024-01-20T12:00:00Z'),
    attendees: [{ email: 'lisa.wang@example.com', name: 'Lisa Wang' }],
    location: 'Wellness Studio - Room 2', 
    meetingType: 'in-person',
  },
  {
    googleEventId: 'admin-007',
    summary: 'Admin Time - Client Notes Review',
    description: 'Weekly admin block for updating client files, reviewing progress notes, and planning upcoming sessions.',
    startTime: new Date('2024-01-21T13:00:00Z'),
    endTime: new Date('2024-01-21T14:00:00Z'),
    attendees: [],
    location: 'Home Office',
    meetingType: 'in-person',
  },
  {
    googleEventId: 'personal-008',
    summary: 'Personal Appointment - Dentist',
    description: 'Regular dental checkup and cleaning.',
    startTime: new Date('2024-01-22T15:00:00Z'),
    endTime: new Date('2024-01-22T16:00:00Z'),
    attendees: [],
    location: 'Dr. Smith Dental Office',
    meetingType: 'in-person',
  },
];

// Sample interactions (emails/communications)
const SAMPLE_INTERACTIONS = [
  {
    type: 'email',
    subject: 'Thank you for today\'s session!',
    content: 'Hi! I wanted to reach out and thank you for the session today. The breathing techniques you taught me really helped when I had that stressful meeting this afternoon. I\'m already feeling more centered. Looking forward to our next session!',
    timestamp: new Date('2024-01-15T12:30:00Z'),
    source: 'gmail',
    sourceId: 'gmail-msg-001',
    clientEmail: 'sarah.johnson@example.com',
  },
  {
    type: 'email',
    subject: 'Question about nutrition plan',
    content: 'Hey there! I\'ve been following the nutrition guidelines you gave me, but I\'m wondering if I can substitute quinoa for brown rice? Also, I\'ve been having more energy in the mornings - is that normal? Thanks!',
    timestamp: new Date('2024-01-16T19:00:00Z'),
    source: 'gmail',
    sourceId: 'gmail-msg-002',
    clientEmail: 'michael.chen@example.com',
  },
  {
    type: 'email',
    subject: 'Concerned about my progress',
    content: 'I\'ve been thinking a lot since our last conversation. I\'m still not sure if I\'m ready to commit to the full program. Can we schedule another call to discuss? I want to make sure this is the right time for me.',
    timestamp: new Date('2024-01-17T21:00:00Z'),
    source: 'gmail',
    sourceId: 'gmail-msg-003',
    clientEmail: 'emily.rodriguez@example.com',
  },
  {
    type: 'email',
    subject: 'Really struggling lately',
    content: 'I know it\'s been a while since we\'ve talked, but I\'m going through a really tough time right now. Work is overwhelming and I\'m having trouble sleeping again. The anxiety is back and worse than before. Can we set up a session soon?',
    timestamp: new Date('2024-01-18T22:45:00Z'),
    source: 'gmail',
    sourceId: 'gmail-msg-004',
    clientEmail: 'david.thompson@example.com',
  },
  {
    type: 'email',
    subject: 'Amazing breakthrough!',
    content: 'I had to share this with you immediately! I used the meditation technique you taught me during a really difficult conversation with my boss today, and I stayed completely calm and centered. I think I\'m finally \'getting it\'! This wellness journey has been life-changing. Thank you so much!',
    timestamp: new Date('2024-01-19T14:20:00Z'),
    source: 'gmail',
    sourceId: 'gmail-msg-005',
    clientEmail: 'lisa.wang@example.com',
  },
];

async function seedTestData(): Promise<void> {
  try {
    console.log('🌱 Starting test data seeding...');

    // 1. Create or get test user
    console.log('👤 Creating test user...');
    let user = await db.query.users.findFirst({
      where: eq(schema.users.email, TEST_USER_EMAIL),
    });

    if (!user) {
      const [newUser] = await db
        .insert(schema.users)
        .values({
          googleId: TEST_USER_GOOGLE_ID,
          email: TEST_USER_EMAIL,
          name: 'Test Wellness Practitioner',
          picture: 'https://via.placeholder.com/150',
          accessToken: 'test-access-token',
          refreshToken: 'test-refresh-token',
        })
        .returning();
      user = newUser;
    }

    console.log(`✅ User ready: ${user.email}`);

    // 2. Create sample contacts
    console.log('👥 Creating sample contacts...');
    const contacts = [];
    for (const clientData of SAMPLE_CLIENTS) {
      // Check if contact already exists
      const existingContact = await db.query.contacts.findFirst({
        where: eq(schema.contacts.email, clientData.email),
      });

      if (!existingContact) {
        const [newContact] = await db
          .insert(schema.contacts)
          .values({
            userId: user.id,
            name: clientData.name,
            email: clientData.email,
            phone: clientData.phone,
            lifecycleStage: clientData.lifecycleStage,
            notes: clientData.notes,
            status: 'active',
            sentiment: Math.floor(Math.random() * 3) + 3, // 3-5 rating
            lastContact: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Within last week
          })
          .returning();
        contacts.push(newContact);
      } else {
        contacts.push(existingContact);
      }
    }

    console.log(`✅ Created ${contacts.length} contacts`);

    // 3. Create calendar events (simulating Google Calendar sync)
    console.log('📅 Creating calendar events...');
    for (const eventData of SAMPLE_CALENDAR_EVENTS) {
      // Check if event already exists
      const existingEvent = await db.query.calendarEvents.findFirst({
        where: eq(schema.calendarEvents.googleEventId, eventData.googleEventId),
      });

      if (!existingEvent) {
        await db.insert(schema.calendarEvents).values({
          userId: user.id,
          googleEventId: eventData.googleEventId,
          rawData: eventData,
          summary: eventData.summary,
          description: eventData.description,
          startTime: eventData.startTime,
          endTime: eventData.endTime,
          attendees: eventData.attendees,
          location: eventData.location,
          meetingType: eventData.meetingType,
          processed: false, // This will trigger LLM processing
          calendarId: 'primary',
          calendarName: 'Primary Calendar',
        });
      }
    }

    console.log(`✅ Created ${SAMPLE_CALENDAR_EVENTS.length} calendar events`);

    // 4. Create sample interactions
    console.log('💬 Creating sample interactions...');
    for (const interactionData of SAMPLE_INTERACTIONS) {
      // Find the contact for this interaction
      const contact = contacts.find(c => c.email === interactionData.clientEmail);
      if (contact) {
        // Check if interaction already exists
        const existingInteraction = await db.query.interactions.findFirst({
          where: eq(schema.interactions.sourceId, interactionData.sourceId),
        });

        if (!existingInteraction) {
          await db.insert(schema.interactions).values({
            contactId: contact.id,
            type: interactionData.type,
            subject: interactionData.subject,
            content: interactionData.content,
            timestamp: interactionData.timestamp,
            source: interactionData.source,
            sourceId: interactionData.sourceId,
            sentiment: Math.floor(Math.random() * 5) + 1, // 1-5 rating
          });
        }
      }
    }

    console.log(`✅ Created ${SAMPLE_INTERACTIONS.length} interactions`);

    console.log('🎉 Test data seeding completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`   • User: ${user.email}`);
    console.log(`   • Contacts: ${contacts.length}`);
    console.log(`   • Calendar Events: ${SAMPLE_CALENDAR_EVENTS.length}`);
    console.log(`   • Interactions: ${SAMPLE_INTERACTIONS.length}`);
    console.log('\n🤖 Ready to test LLM processing!');
    console.log('   Run the server and trigger calendar event processing to see OpenRouter/Gemini in action.');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

// Run the seeding
seedTestData().then(() => {
  console.log('\n✨ Seeding complete - you can now test your LLM integration!');
  process.exit(0);
});
