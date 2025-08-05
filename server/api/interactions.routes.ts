import { Router, type Request, type Response } from 'express';
import { interactionService } from '../services/interaction.service.js';
import { requireAuth } from '../utils/jwt-auth.js';
import {
  apiRateLimit,
  csrfProtection,
  validateInteractionCreation,
  handleValidationErrors,
} from '../utils/security.js';
import { isAuthenticatedUser } from '../utils/type-guards.js';
import { sanitizeResponse } from '../utils/sanitizers.js';
import { createErrorResponse, logError } from '../utils/error-handling.js';
import { createInteractionSchema } from '../schemas/interaction.schemas.js';

const interactionsRouter = Router();

interactionsRouter.use(requireAuth);

// --- Interactions ---

// GET recent interactions
interactionsRouter.get('/interactions/recent', apiRateLimit, async (req, res) => {
  try {
    if (!isAuthenticatedUser(req.user)) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const interactions = await interactionService.getRecentInteractions(req.user.id, limit);
    res.json(sanitizeResponse(interactions));
  } catch (error) {
    logError('Failed to fetch recent interactions', error);
    res.status(500).json(createErrorResponse('Failed to fetch recent interactions', error, true));
  }
});

// POST a new interaction
interactionsRouter.post(
  '/interactions',
  apiRateLimit,
  csrfProtection,
  validateInteractionCreation,
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      // Validate request body
      const bodyResult = createInteractionSchema.safeParse(req.body);
      if (!bodyResult.success) {
        return res.status(400).json({ 
          error: 'Invalid interaction data', 
          details: bodyResult.error.errors 
        });
      }
      
      const { timestamp, ...interactionData } = bodyResult.data;
      const processedData = {
        ...interactionData,
        timestamp: new Date(timestamp),
      };
      
      const interaction = await interactionService.createInteraction(processedData);
      res.status(201).json(interaction);
    } catch (error) {
      logError('Create interaction error', error);
      res.status(500).json(createErrorResponse('Failed to create interaction', error, true));
    }
  }
);

// --- Goals ---

// POST a new goal
interactionsRouter.post('/goals', async (req, res) => {
  try {
    const goal = await interactionService.createGoal(req.body);
    res.status(201).json(goal);
  } catch (error) {
    logError('Failed to create goal', error);
    res.status(500).json(createErrorResponse('Failed to create goal', error, true));
  }
});

// PATCH an existing goal
interactionsRouter.patch('/goals/:id', async (req, res) => {
  try {
    const goal = await interactionService.updateGoal(req.params.id, req.body);
    res.json(goal);
  } catch (error) {
    logError('Failed to update goal', error);
    res.status(500).json(createErrorResponse('Failed to update goal', error, true));
  }
});

export default interactionsRouter;
