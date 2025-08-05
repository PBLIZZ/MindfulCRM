import { storage } from '../data/index.js';
import { geminiService } from '../providers/gemini.provider.js';
import { ChatBrain } from '../brains/chat.brain.js';
import { type ContactInsights } from '../types/brain-types.js';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import {
  PhotoEnrichmentService,
  type PhotoSuggestion,
  type EnrichmentResult,
  type BatchEnrichmentResult,
} from '../utils/photo-enrichment.js';
import { taskAI } from '../brains/task-ai.js';
import { taskScheduler } from './task-scheduler.js';
import { rateLimiter, type UsageStats, type ModelRecommendation } from '../utils/rate-limiter.js';
import { type AiSuggestion, type Contact } from '../../shared/schema.js';
import OpenAI from 'openai';

// Initialize services by injecting only the specific data modules they need.
// This follows the principle of least privilege and improves modularity.
import { GenerateInsightsBrain } from '../brains/generate-insights.brain.js';
// import { openRouterService } from '../providers/openrouter.provider.js'; // TODO: Use this provider instead of direct OpenAI client

const generateInsightsBrain = new GenerateInsightsBrain();
const photoEnrichmentService = new PhotoEnrichmentService();

// Initialize OpenRouter client for direct LLM processing
const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

export class AiService {
  // --- Chat ---
  async generateChatResponse(message: string, context?: Record<string, unknown>): Promise<string> {
    const chatBrain = new ChatBrain();
    return chatBrain.execute(geminiService, 'gemini-2.0-flash-exp', message, context);
  }

  // --- Insights ---
  async generateContactInsights(contactId: string): Promise<ContactInsights> {
    const contact = await storage.contacts.getById(contactId);
    if (!contact) {
      throw new Error('Contact not found');
    }

    const [interactions, goals] = await Promise.all([
      storage.interactions.getByContactId(contact.id),
      storage.interactions.getGoalsByContactId(contact.id),
    ]);

    // The service expects a fully populated object, which we construct here.
    const contactDataForInsights: Contact & {
      interactions: typeof interactions;
      goals: typeof goals;
    } = {
      ...contact,
      interactions,
      goals,
    };

    // Create a provider interface that the brain can use
    const provider = {
      generateCompletion: async (model: string, messages: ChatCompletionMessageParam[], isJson: boolean) => {
        const response = await openrouter.chat.completions.create({
          model,
          messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
          ...(isJson ? { response_format: { type: 'json_object' } } : {}),
        });
        return response.choices[0]?.message?.content ?? '';
      }
    };

    return generateInsightsBrain.execute(provider, 'moonshotai/kimi-k2', contactDataForInsights);
  }

  // --- Photo Enrichment ---
  async batchEnrichPhotos(userId: string): Promise<BatchEnrichmentResult> {
    return photoEnrichmentService.batchEnrichPhotos(userId);
  }

  async findPhotoSuggestions(contactId: string): Promise<PhotoSuggestion[]> {
    const contact = await storage.contacts.getById(contactId);
    if (!contact) {
      throw new Error('Contact not found');
    }
    // The photo enrichment service expects a specific ContactInfo shape
    return photoEnrichmentService.findPhotoSuggestions({
      id: contact.id,
      name: contact.name,
      email: contact.email,
      phone: contact.phone ?? null,
      allowProfilePictureScraping: contact.hasGdprConsent ?? false,
      company:
        typeof contact.extractedFields === 'object' && contact.extractedFields !== null
          ? (contact.extractedFields as { company?: string }).company
          : undefined,
      linkedinUrl:
        typeof contact.socialMediaHandles === 'object' && contact.socialMediaHandles !== null
          ? (contact.socialMediaHandles as { linkedin?: string }).linkedin
          : undefined,
      jobTitle:
        typeof contact.extractedFields === 'object' && contact.extractedFields !== null
          ? (contact.extractedFields as { jobTitle?: string }).jobTitle
          : undefined,
    });
  }

  async enrichSingleContactPhoto(contactId: string): Promise<EnrichmentResult> {
    return photoEnrichmentService.enrichSingleContact(contactId);
  }

  async getPhotoEnrichmentStats(userId: string): Promise<{
    totalContacts: number;
    contactsWithPhotos: number;
    contactsConsented: number;
    contactsEligible: number;
  }> {
    const contacts = await storage.contacts.getByUserId(userId);
    return {
      totalContacts: contacts.length,
      contactsWithPhotos: contacts.filter((c) => !!c.avatarUrl).length,
      contactsConsented: contacts.filter((c) => !!c.hasGdprConsent).length,
      contactsEligible: contacts.filter((c) => !!c.hasGdprConsent && !c.avatarUrl).length,
    };
  }

  async downloadAndSaveContactPhoto(
    contactId: string, 
    photoUrl: string, 
    source: string
  ): Promise<{ success: boolean; avatarUrl?: string; error?: string }> {
    return photoEnrichmentService.downloadAndSavePhoto(contactId, photoUrl, source);
  }

  // --- AI Suggestions ---
  async getSuggestions(userId: string, status?: string): Promise<AiSuggestion[]> {
    return storage.ai.getSuggestionsByUserId(userId, status);
  }

  async approveSuggestion(
    suggestionId: string
  ): Promise<{ success: boolean; suggestion: AiSuggestion }> {
    const suggestion = await storage.ai.updateSuggestion(suggestionId, {
      status: 'approved',
      reviewedAt: new Date(),
    });
    const success = await taskAI.executeAISuggestion(suggestionId);
    return { success, suggestion };
  }

  async rejectSuggestion(suggestionId: string, reason?: string): Promise<AiSuggestion> {
    return storage.ai.updateSuggestion(suggestionId, {
      status: 'rejected',
      reviewedAt: new Date(),
      rejectionReason: reason ?? '',
    });
  }

  // --- Data Processing ---
  async processAttendanceCsv(
    userId: string,
    csvData: string,
    fileName: string
  ): Promise<AiSuggestion[]> {
    return taskAI.processAttendanceCSV(userId, csvData, fileName);
  }

  async processNewPhotos(
    userId: string,
    photoData: { contactId: string; photoUrl: string; source: string }[]
  ): Promise<AiSuggestion[]> {
    return taskAI.processNewPhotos(userId, photoData);
  }

  async triggerImmediateAnalysis(userId: string): Promise<void> {
    return taskScheduler.triggerImmediateAnalysis(userId);
  }

  // --- Usage and Rate Limiting ---
  async getUsageStats(userId: string): Promise<UsageStats> {
    return rateLimiter.getUsageStats(userId);
  }

  getRecommendedModel(eventCount?: number, isHistoricalSync?: boolean): ModelRecommendation {
    return rateLimiter.getRecommendedModel(eventCount ?? 0, isHistoricalSync ?? false);
  }

  // --- Direct LLM Processing ---
  /**
   * Process generic text prompts using OpenRouter
   * Migrated from llm-processor.archive.ts
   */
  async processGenericPrompt(prompt: string, _userId: string): Promise<string> {
    try {
      const response = await openrouter.chat.completions.create({
        model: 'meta-llama/llama-3.1-8b-instruct:free',
        messages: [
          {
            role: 'system',
            content:
              'You are a helpful AI assistant for a wellness CRM system. Provide accurate and structured responses.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 1500,
      });

      return response.choices[0]?.message?.content ?? '';
    } catch (error) {
      console.error('LLM prompt processing error:', error);
      throw error;
    }
  }

  /**
   * Process text using Kimi model for advanced reasoning
   * Migrated from llm-processor.archive.ts - used for social media handle extraction
   */
  async processWithKimi(prompt: string): Promise<string> {
    try {
      const response = await openrouter.chat.completions.create({
        model: 'moonshotai/kimi-k2',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful AI assistant. Provide accurate and detailed responses.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 2000,
      });

      return response.choices[0]?.message?.content ?? '';
    } catch (error) {
      console.error('Kimi processing error:', error);
      throw error;
    }
  }
}

export const aiService = new AiService();
