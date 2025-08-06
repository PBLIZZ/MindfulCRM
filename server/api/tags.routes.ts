import { Router } from 'express';
import { tagService } from '../services/tag.service.js';
import { requireAuth } from '../utils/jwt-auth.js';
import { createErrorResponse, logError } from '../utils/error-handling.js';
import { createTagSchema } from '../schemas/tag.schemas.js';

const tagsRouter = Router();

tagsRouter.use(requireAuth);

// GET all tags
tagsRouter.get('/', async (_req, res) => {
  try {
    const tags = await tagService.getAllTags();
    res.json(tags);
  } catch (error) {
    logError('Failed to fetch tags', error);
    res.status(500).json(createErrorResponse('Failed to fetch tags', error, true));
  }
});

// POST a new tag
tagsRouter.post('/', async (req, res) => {
  try {
    // Validate request body
    const bodyResult = createTagSchema.safeParse(req.body);
    if (!bodyResult.success) {
      return res.status(400).json({
        error: 'Invalid tag data',
        details: bodyResult.error.errors
      });
    }

    const tag = await tagService.createTag(bodyResult.data);
    res.status(201).json(tag);
  } catch (error: unknown) {
    logError('Tag creation error', error);
    const message = error instanceof Error ? error.message : 'Failed to create tag';
    const statusCode = message.includes('already exists') ? 409 : 500;
    res.status(statusCode).json(createErrorResponse(message, error, true));
  }
});

export default tagsRouter;
