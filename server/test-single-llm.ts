#!/usr/bin/env tsx

import dotenv from 'dotenv';
dotenv.config();

import { openRouterService } from './services/openrouter';
import { geminiService } from './services/gemini';
import { mistralService } from './services/mistral';
import { aiService } from './services/openai';

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testSingleLLMFunction() {
  console.log('🧪 Testing Individual LLM Functions...');
  console.log('='.repeat(50));

  try {
    // Test 1: Mistral Sentiment Analysis
    console.log('\n💭 Test 1: Mistral Sentiment Analysis');
    console.log('-'.repeat(30));
    
    const testText = "Thank you for today's session! The breathing exercises really helped during my presentation.";
    console.log(`Testing: "${testText}"`);
    
    try {
      const sentiment = await mistralService.analyzeSentiment(testText);
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
    
    const chatMessage = "What should I do if a client missed their appointment?";
    console.log(`Testing: "${chatMessage}"`);
    
    try {
      const chatResponse = await geminiService.generateChatResponse(chatMessage);
      console.log(`✅ Response (first 200 chars): ${chatResponse.substring(0, 200)}...`);
    } catch (error) {
      console.error(`❌ Error:`, error instanceof Error ? error.message : error);
    }

    // Test 3: Simple Insights Generation
    console.log('\n📈 Test 4: Contact Insights Generation');
    console.log('-'.repeat(30));
    
    const mockContactData = {
      name: "Emma Rodriguez",
      email: "emma.rodriguez@email.com",
      sentiment: 4,
      lastContact: new Date('2025-01-30T10:00:00Z'),
      recentInteractions: [
        {
          type: "email",
          content: "Thank you for today's session! The breathing exercises really helped.",
          timestamp: new Date('2025-01-30T15:30:00Z'),
          sentiment: 5
        }
      ]
    };

    console.log('Testing with mock contact data...');
    
    try {
      await delay(15000); // Wait again to avoid rate limits
      const insights = await openRouterService.generateInsights(mockContactData);
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
