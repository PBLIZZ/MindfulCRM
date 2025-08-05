import { Router, type Request, type Response } from 'express';
import { aiService } from '../services/ai.service.js';
import { contactService } from '../services/contact.service.js';
import { enhancedLLMService } from '../services/llm-enhanced.service.js';
import { llmConcurrencyController } from '../utils/llm-concurrency-controller.js';
import { llmCostTracker } from '../utils/llm-cost-tracker.js';
import { requireAuth } from '../utils/jwt-auth.js';
import {
  aiRateLimit,
  csrfProtection,
  validateContactId,
  handleValidationErrors,
} from '../utils/security.js';
import { isAuthenticatedUser } from '../utils/type-guards.js';
import { sanitizeResponse } from '../utils/sanitizers.js';
import { nullsToUndefined } from '../utils/api-helpers.js';
import { createErrorResponse, logError } from '../utils/error-handling.js';
import { enrichPhotoSchema } from '../schemas/ai.schemas.js';

const aiRouter = Router();

aiRouter.use(requireAuth);

// --- Chat ---
aiRouter.post(
  '/ai/chat',
  aiRateLimit,
  csrfProtection,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { message, context } = req.body as {
        message: string;
        context?: Record<string, unknown>;
      };
      const response = await aiService.generateChatResponse(message, context);
      res.json(sanitizeResponse({ response }));
    } catch (error: unknown) {
      logError('AI chat error', error);
      res.status(500).json(createErrorResponse('Failed to generate AI response', error, true));
    }
  }
);

// --- Insights ---
aiRouter.post(
  '/ai/insights/:contactId',
  aiRateLimit,
  csrfProtection,
  validateContactId,
  handleValidationErrors,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const insights = await aiService.generateContactInsights(req.params.contactId);
      res.json(nullsToUndefined(insights));
    } catch (error: unknown) {
      logError('AI insights error', error);
      res.status(500).json(createErrorResponse('Failed to generate insights', error, true));
    }
  }
);

// --- Photo Enrichment ---
aiRouter.post(
  '/photo-enrichment/batch',
  aiRateLimit,
  csrfProtection,
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!isAuthenticatedUser(req.user)) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }
      const results = await aiService.batchEnrichPhotos(req.user.id);
      res.json(sanitizeResponse(results));
    } catch (error: unknown) {
      logError('Batch photo enrichment error', error);
      res.status(500).json(createErrorResponse('Failed to batch enrich photos', error, true));
    }
  }
);

aiRouter.get(
  '/contacts/:id/photo-suggestions',
  validateContactId,
  handleValidationErrors,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const suggestions = await aiService.findPhotoSuggestions(req.params.id);
      res.json({ suggestions });
    } catch (error: unknown) {
      logError('Photo suggestions error', error);
      res.status(500).json(createErrorResponse('Failed to find photo suggestions', error, true));
    }
  }
);

// Apply a specific photo suggestion to a contact
aiRouter.post(
  '/contacts/:id/enrich-photo',
  aiRateLimit,
  csrfProtection,
  validateContactId,
  handleValidationErrors,
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!isAuthenticatedUser(req.user)) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      // Validate request body
      const validationResult = enrichPhotoSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({
          error: 'Invalid request data',
          details: validationResult.error.errors
        });
        return;
      }

      const { photoUrl, source } = validationResult.data;
      const contactId = req.params.id;

      // Check if contact belongs to user (security check)
      const contact = await contactService.getContactDetails(contactId);
      if (!contact || contact.userId !== req.user.id) {
        res.status(404).json({ error: 'Contact not found' });
        return;
      }

      // Apply the photo suggestion by downloading and saving it
      const result = await aiService.downloadAndSaveContactPhoto(contactId, photoUrl, source);
      
      if (result.success) {
        res.json(nullsToUndefined(sanitizeResponse({
          success: true,
          avatarUrl: result.avatarUrl,
          message: 'Photo applied successfully'
        })));
        return;
      } else {
        res.status(400).json({ 
          error: result.error ?? 'Failed to apply photo suggestion'
        });
        return;
      }
    } catch (error: unknown) {
      logError('Apply photo suggestion error', error);
      res.status(500).json(createErrorResponse('Failed to apply photo suggestion', error, true));
    }
  }
);

aiRouter.get('/photo-enrichment/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isAuthenticatedUser(req.user)) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }
    const stats = await aiService.getPhotoEnrichmentStats(req.user.id);
    res.json(sanitizeResponse(stats));
  } catch (error: unknown) {
    logError('Photo enrichment stats error', error);
    res.status(500).json(createErrorResponse('Failed to fetch enrichment stats', error, true));
  }
});

// --- AI Suggestions ---
aiRouter.get('/ai-suggestions', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isAuthenticatedUser(req.user)) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }
    const { status } = req.query;
    const suggestions = await aiService.getSuggestions(req.user.id, status as string);
    res.json(suggestions);
  } catch (error: unknown) {
    logError('Get AI suggestions error', error);
    res.status(500).json(createErrorResponse('Failed to fetch AI suggestions', error, true));
  }
});

aiRouter.patch(
  '/ai-suggestions/:id/approve',
  csrfProtection,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { success, suggestion } = await aiService.approveSuggestion(req.params.id);
      res.json({
        success,
        suggestion,
        message: success
          ? 'Suggestion approved and executed'
          : 'Suggestion approved but execution failed',
      });
    } catch (error: unknown) {
      logError('Approve AI suggestion error', error);
      res.status(500).json(createErrorResponse('Failed to approve AI suggestion', error, true));
    }
  }
);

aiRouter.patch(
  '/ai-suggestions/:id/reject',
  csrfProtection,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { reason } = req.body as { reason?: string };
      const suggestion = await aiService.rejectSuggestion(req.params.id, reason);
      res.json({ success: true, suggestion });
    } catch (error: unknown) {
      logError('Reject AI suggestion error', error);
      res.status(500).json(createErrorResponse('Failed to reject AI suggestion', error, true));
    }
  }
);

// --- Data Processing & Analysis Triggers ---
aiRouter.post(
  '/data-processing/attendance-csv',
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!isAuthenticatedUser(req.user)) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }
      const { csvData, fileName } = req.body as {
        csvData?: string;
        fileName?: string;
      };
      if (!csvData || !fileName) {
        res.status(400).json({ error: 'csvData and fileName are required' });
        return;
      }

      const suggestions = await aiService.processAttendanceCsv(req.user.id, csvData, fileName);
      res.json({ success: true, suggestionsCreated: suggestions.length, suggestions });
    } catch (error: unknown) {
      logError('Process attendance CSV error', error);
      res.status(500).json(createErrorResponse('Failed to process attendance CSV', error, true));
    }
  }
);

aiRouter.post('/ai/trigger-analysis', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isAuthenticatedUser(req.user)) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }
    await aiService.triggerImmediateAnalysis(req.user.id);
    res.json({
      success: true,
      message: 'AI analysis triggered. Check AI suggestions for results.',
    });
  } catch (error: unknown) {
    logError('Trigger AI analysis error', error);
    res.status(500).json(createErrorResponse('Failed to trigger AI analysis', error, true));
  }
});

// --- Usage & Rate Limiting ---
aiRouter.get('/rate-limit/usage', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isAuthenticatedUser(req.user)) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }
    const usageStats = await aiService.getUsageStats(req.user.id);
    res.json(usageStats);
  } catch (error: unknown) {
    logError('Usage stats error', error);
    res.status(500).json(createErrorResponse('Failed to get usage statistics', error, true));
  }
});

aiRouter.post('/rate-limit/recommend', async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventCount, isHistoricalSync } = req.body as {
      eventCount?: number;
      isHistoricalSync?: boolean;
    };
    const recommendation = aiService.getRecommendedModel(eventCount, isHistoricalSync);
    res.json(recommendation);
  } catch (error: unknown) {
    logError('Model recommendation error', error);
    res.status(500).json(createErrorResponse('Failed to get model recommendation', error, true));
  }
});

// --- Enhanced LLM Performance & Cost Management ---
aiRouter.get('/llm/performance-metrics', async (req: Request, res: Response): Promise<void> => {
  try {
    const metrics = enhancedLLMService.getMetrics();
    res.json(sanitizeResponse(metrics));
  } catch (error: unknown) {
    logError('Performance metrics error', error);
    res.status(500).json(createErrorResponse('Failed to get performance metrics', error, true));
  }
});

aiRouter.get('/llm/cost-analysis', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isAuthenticatedUser(req.user)) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }
    const analysis = enhancedLLMService.getUserCostAnalysis(req.user.id);
    res.json(sanitizeResponse(analysis));
  } catch (error: unknown) {
    logError('Cost analysis error', error);
    res.status(500).json(createErrorResponse('Failed to get cost analysis', error, true));
  }
});

aiRouter.post(
  '/llm/set-budget',
  csrfProtection,
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!isAuthenticatedUser(req.user)) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { dailyLimit, monthlyLimit, alertThreshold } = req.body as {
        dailyLimit?: number;
        monthlyLimit?: number;
        alertThreshold?: number;
      };

      if (typeof dailyLimit !== 'number' || typeof monthlyLimit !== 'number') {
        res.status(400).json({ error: 'dailyLimit and monthlyLimit must be numbers' });
        return;
      }

      enhancedLLMService.setUserBudget(req.user.id, {
        dailyLimit,
        monthlyLimit,
        alertThreshold: alertThreshold ?? 80,
      });

      res.json({ success: true, message: 'Budget limits set successfully' });
    } catch (error: unknown) {
      logError('Set budget error', error);
      res.status(500).json(createErrorResponse('Failed to set budget limits', error, true));
    }
  }
);

aiRouter.get('/llm/concurrency-stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = llmConcurrencyController.getStats();
    res.json(sanitizeResponse(stats));
  } catch (error: unknown) {
    logError('Concurrency stats error', error);
    res.status(500).json(createErrorResponse('Failed to get concurrency statistics', error, true));
  }
});

aiRouter.post(
  '/llm/adjust-concurrency',
  csrfProtection,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { limit } = req.body as { limit?: number };

      if (typeof limit !== 'number' || limit < 1 || limit > 20) {
        res
          .status(400)
          .json({ error: 'Concurrency limit must be a number between 1 and 20' });
        return;
      }

      llmConcurrencyController.adjustConcurrency(limit);
      res.json({ success: true, message: `Concurrency limit adjusted to ${limit}` });
    } catch (error: unknown) {
      logError('Adjust concurrency error', error);
      res.status(500).json(createErrorResponse('Failed to adjust concurrency limit', error, true));
    }
  }
);

aiRouter.get('/llm/system-stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const systemStats = llmCostTracker.getSystemStats();
    res.json(sanitizeResponse(systemStats));
  } catch (error: unknown) {
    logError('System stats error', error);
    res.status(500).json(createErrorResponse('Failed to get system statistics', error, true));
  }
});

// Health check endpoint for LLM services
aiRouter.get('/llm/health', async (req: Request, res: Response): Promise<void> => {
  try {
    const concurrencyStats = llmConcurrencyController.getStats();
    const isHealthy = concurrencyStats.failed < concurrencyStats.completed * 0.1; // Less than 10% failure rate

    res.status(isHealthy ? 200 : 503).json(
      sanitizeResponse({
        status: isHealthy ? 'healthy' : 'degraded',
        concurrency: {
          active: concurrencyStats.active,
          queued: concurrencyStats.queued,
          successRate:
            concurrencyStats.completed > 0
              ? (
                  ((concurrencyStats.completed - concurrencyStats.failed) /
                    concurrencyStats.completed) *
                  100
                ).toFixed(1)
              : '100.0',
        },
        timestamp: new Date().toISOString(),
      })
    );
  } catch (error: unknown) {
    logError('Health check error', error);
    res.status(503).json({ status: 'unhealthy', error: 'Health check failed' });
  }
});

export default aiRouter;
