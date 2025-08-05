#!/usr/bin/env tsx

import dotenv from 'dotenv';
dotenv.config();

import { geminiService } from '../providers/gemini.provider.js';
import { ChatBrain } from '../brains/chat.brain.js';
import { SentimentAnalysisBrain } from '../brains/sentiment-analysis.brain.js';
import { GenerateInsightsBrain } from '../brains/generate-insights.brain.js';
import { mistralService } from '../providers/mistral.provider.js';
import type { Contact, Interaction } from '../../shared/schema.js';
import type { ContactData as _ContactData } from '../types/external-apis.js';

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function testSingleLLMFunction() {
  console.log('🧪 Testing Individual LLM Functions...');
  console.log('='.repeat(50));

  try {
    // Test 1: Mistral Sentiment Analysis
    console.log('\n💭 Test 1: Mistral Sentiment Analysis');
    console.log('-'.repeat(30));

    const testText =
      "Thank you for today's session! The breathing exercises really helped during my presentation.";
    console.log(`Testing: "${testText}"`);

    try {
      const sentimentBrain = new SentimentAnalysisBrain();
      const sentiment = await sentimentBrain.execute(
        mistralService,
        'mistral-small-latest',
        testText
      );
      console.log(`✅ Result: Rating ${sentiment.rating}/5, Confidence: ${sentiment.confidence}`);
    } catch (error) {
      console.error(`❌ Error:`, error instanceof Error ? error.message : error);
    }

    // Wait to avoid rate limiting
    console.log('\n⏱️  Waiting 15 seconds to avoid rate limits...');
    await delay(15000);

    // Test 2: Gemini Chat Response
    console.log('\n🤖 Test 2: Gemini Chat Response');
    console.log('-'.repeat(30));

    const chatMessage = 'What should I do if a client missed their appointment?';
    console.log(`Testing: "${chatMessage}"`);

    try {
      const chatBrain = new ChatBrain();
      const chatResponse = await chatBrain.execute(
        geminiService,
        'gemini-2.0-flash-exp',
        chatMessage
      );
      console.log(`✅ Response (first 200 chars): ${chatResponse.substring(0, 200)}...`);
    } catch (error) {
      console.error(`❌ Error:`, error instanceof Error ? error.message : error);
    }

    // Test 3: Simple Insights Generation
    console.log('\n📈 Test 4: Contact Insights Generation');
    console.log('-'.repeat(30));

    const mockContact: Contact = {
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      userId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
      name: 'Emma Rodriguez',
      email: 'emma.rodriguez@email.com',
      phone: '555-1234',
      avatarUrl: null,
      lastContact: new Date('2025-01-30T10:00:00Z'),
      sentiment: 4,
      engagementTrend: 'stable',
      status: 'active',
      notes: 'A model client.',
      lifecycleStage: 'core_client',
      extractedFields: null,
      revenueData: null,
      referralCount: 0,
      hasGdprConsent: true,
      gdprConsentFormPath: null,
      socialMediaHandles: null,
      profilePictureSource: null,
      profilePictureScrapedAt: null,
      sex: 'female',
      createdAt: new Date('2024-01-01T10:00:00Z'),
      updatedAt: new Date('2025-01-30T10:00:00Z'),
    };

    const _mockInteractions: Interaction[] = [
      {
        id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
        contactId: mockContact.id,
        type: 'email',
        subject: "Re: Today's session",
        content: "Thank you for today's session! The breathing exercises really helped.",
        timestamp: new Date('2025-01-30T15:30:00Z'),
        source: 'gmail',
        sourceId: 'gmail-123',
        sentiment: 5,
        createdAt: new Date('2025-01-30T15:30:00Z'),
      },
    ];

    // Create proper InsightBrainInput with full contact data and mock interactions/goals
    const mockContactData = {
      ...mockContact,
      interactions: _mockInteractions, // Use the mock interactions we created above
      goals: [], // Empty array for test - in real usage, this might have goals
    };

    console.log('Testing with mock contact data...');

    try {
      await delay(15000); // Wait again to avoid rate limits
      const generateInsightsBrain = new GenerateInsightsBrain();
      const insights = await generateInsightsBrain.execute(
        geminiService,
        'gemini-2.0-flash-exp',
        mockContactData
      );
      console.log(`✅ Generated insights:`);
      console.log(`   Summary: ${insights.summary}`);
      console.log(`   Next Steps: ${insights.nextSteps.length} items`);
      console.log(`   Risk Factors: ${insights.riskFactors.length} items`);
    } catch (error) {
      console.error(`❌ Insights Error:`, error instanceof Error ? error.message : error);
    }

    console.log('\n' + '='.repeat(50));
    console.log('🎉 Individual LLM Function Tests Complete!');
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  }
}

// Check if this file is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testSingleLLMFunction()
    .then(() => {
      console.log('✨ Single LLM tests completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Tests failed:', error);
      process.exit(1);
    });
}

export { testSingleLLMFunction };
