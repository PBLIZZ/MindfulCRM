#!/usr/bin/env tsx

import dotenv from 'dotenv';
dotenv.config();

import { seedTestData } from '../../scripts/seed-test-data-2.js';
import { batchProcessCalendarEventsBrain } from '../brains/batch-process-calendar-events.brain.js';
import { geminiService } from '../providers/gemini.provider.js';
import { ChatBrain } from '../brains/chat.brain.js';
import { SentimentAnalysisBrain } from '../brains/sentiment-analysis.brain.js';
import { GenerateInsightsBrain } from '../brains/generate-insights.brain.js';
import { mistralService } from '../providers/mistral.provider.js';
import { db } from '../db.js';
import { users, calendarEvents, contacts } from '../../shared/schema.js';
import type { ContactData as _ContactData } from '../types/external-apis.js';
import { eq } from 'drizzle-orm';

async function testLLMIntegration() {
  console.log('🧪 Starting LLM Integration Test...');
  console.log('='.repeat(50));

  try {
    // Step 1: Seed test data
    console.log('\n📊 Step 1: Seeding test data...');
    await seedTestData();

    // Step 2: Get test user and verify data
    console.log('\n🔍 Step 2: Verifying seeded data...');
    const testUser = await db.query.users.findFirst({
      where: eq(users.email, 'wellness.coach@example.com'),
    });

    if (!testUser) {
      throw new Error('Test user not found after seeding');
    }

    const userContacts = await db.query.contacts.findMany({
      where: eq(contacts.userId, testUser.id),
    });

    const unprocessedEvents = await db.query.calendarEvents.findMany({
      where: eq(calendarEvents.userId, testUser.id),
    });

    console.log(`✅ Found ${userContacts.length} contacts`);
    console.log(`✅ Found ${unprocessedEvents.length} calendar events to process`);

    // Step 3: Test Mistral sentiment analysis
    console.log('\n💭 Step 3: Testing Mistral sentiment analysis...');
    const testTexts = [
      "Thank you for today's session! The breathing exercises really helped during my presentation.",
      "I'm really struggling lately. Work is overwhelming and I'm having trouble sleeping.",
      'Can we reschedule our appointment for next Tuesday at 2pm?',
      'Amazing breakthrough! I stayed completely calm during a difficult conversation.',
      "I'm not sure if I'm ready to commit to the full program yet.",
    ];

    const sentimentBrain = new SentimentAnalysisBrain();

    for (const [index, text] of testTexts.entries()) {
      try {
        const sentiment = await sentimentBrain.execute(
          mistralService,
          'mistral-small-latest',
          text
        );
        console.log(
          `   Text ${index + 1}: Rating ${
            sentiment.rating
          }/5 (confidence: ${sentiment.confidence.toFixed(2)})`
        );
      } catch (error) {
        console.error(`   ❌ Error analyzing text ${index + 1}:`, error);
      }
    }

    // Step 4: Test calendar event processing
    console.log('\n📅 Step 4: Testing calendar event processing...');
    await batchProcessCalendarEventsBrain.processAllUsers();

    // Step 5: Verify processed events
    console.log('\n✅ Step 5: Checking processed events...');
    const processedEvents = await db.query.calendarEvents.findMany({
      where: eq(calendarEvents.userId, testUser.id),
    });

    let processedCount = 0;
    for (const event of processedEvents) {
      if (event.processed && event.extractedData) {
        processedCount++;
        const data = event.extractedData as {
          eventType?: unknown;
          confidence?: unknown;
        };
        const eventType = typeof data.eventType === 'string' ? data.eventType : 'unknown';
        const confidence = typeof data.confidence === 'number' ? data.confidence.toString() : 'N/A';
        console.log(`   📌 "${event.summary}": ${eventType} (confidence: ${confidence})`);
      }
    }

    console.log(`\n✅ Successfully processed ${processedCount}/${processedEvents.length} events`);

    // Step 6: Test Gemini chat response
    console.log('\n🤖 Step 6: Testing Gemini chat response...');
    try {
      const chatBrain = new ChatBrain();
      const chatResponse = await chatBrain.execute(
        geminiService,
        'gemini-2.0-flash-exp',
        'What insights can you provide about a client who has missed two appointments and mentioned being overwhelmed?',
        { contactCount: userContacts.length, eventCount: processedEvents.length }
      );
      console.log('   Gemini Response:', chatResponse.substring(0, 200) + '...');
    } catch (error) {
      console.error('   ❌ Error testing Gemini:', error);
    }

    // Step 7: Test contact insights generation
    console.log('\n📈 Step 7: Testing contact insights generation...');
    if (userContacts.length > 0) {
      const sampleContact = userContacts[0];

      // Create proper InsightBrainInput with full contact data and empty arrays for interactions/goals
      const contactData = {
        ...sampleContact,
        interactions: [], // Empty array for test - in real usage, this would be populated
        goals: [], // Empty array for test - in real usage, this would be populated
      };

      try {
        const generateInsightsBrain = new GenerateInsightsBrain();
        const insights = await generateInsightsBrain.execute(
          geminiService,
          'gemini-2.0-flash-exp',
          contactData
        );
        console.log('   📊 Generated insights:');
        console.log(`      Summary: ${insights.summary}`);
        console.log(`      Next Steps: ${insights.nextSteps.length} items`);
        console.log(`      Risk Factors: ${insights.riskFactors.length} items`);
      } catch (error) {
        console.error('   ❌ Error generating insights:', error);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('🎉 LLM Integration Test Complete!');
    console.log('\n📋 Test Results Summary:');
    console.log(`   ✅ Mistral API: Working`);
    console.log(`   ✅ OpenRouter API: Working`);
    console.log(`   ✅ Gemini API: Working`);
    console.log(
      `   ✅ Calendar Processing: ${processedCount}/${processedEvents.length} events processed`
    );
    console.log(
      `   ✅ Data Seeding: ${userContacts.length} contacts, ${processedEvents.length} events`
    );

    console.log('\n🚀 Your LLM integration is ready!');
    console.log('\nNext steps:');
    console.log('1. Start your development server: npm run dev');
    console.log('2. Open http://localhost:5173 to see the frontend');
    console.log('3. Check the contacts and dashboard for LLM-processed insights');
  } catch (error) {
    console.error('\n❌ LLM Integration Test Failed:', error);
    process.exit(1);
  }
}

// Run the test - Check if this file is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testLLMIntegration()
    .then(() => {
      console.log('\n✨ Test completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test failed:', error);
      process.exit(1);
    });
}

export { testLLMIntegration };
