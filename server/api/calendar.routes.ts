import { Router } from 'express';
import { calendarService } from '../services/calendar.service.js';
import { requireAuth } from '../utils/jwt-auth.js';
import { isAuthenticatedUser } from '../utils/type-guards.js';
import { createErrorResponse, logError } from '../utils/error-handling.js';
import { calendarEventQuerySchema, calendarSyncRequestSchema } from '../schemas/calendar.schemas.js';

const calendarRouter = Router();

calendarRouter.use(requireAuth);

// GET calendar events, optionally filtered by month
calendarRouter.get('/events', async (req, res) => {
  if (!isAuthenticatedUser(req.user)) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  // Validate query parameters
  const queryValidation = calendarEventQuerySchema.safeParse(req.query);
  if (!queryValidation.success) {
    return res.status(400).json({
      error: 'Invalid query parameters',
      details: queryValidation.error.errors
    });
  }

  try {
    const { month } = queryValidation.data;
    const events = await calendarService.getCalendarEvents(req.user.id, month);
    res.json(events);
  } catch (error: unknown) {
    logError('Failed to fetch calendar events', error);
    res.status(500).json(createErrorResponse('Failed to fetch calendar events', error, true));
  }
});

// GET upcoming events for the dashboard
calendarRouter.get('/upcoming', async (req, res) => {
  try {
    if (!isAuthenticatedUser(req.user)) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const limit = parseInt(req.query.limit as string) || 5;
    const events = await calendarService.getUpcomingEvents(req.user.id, limit);
    res.json(events);
  } catch (error) {
    logError('Error fetching upcoming events:', error);
    res.status(500).json(createErrorResponse('Failed to fetch upcoming events', error, true));
  }
});

// POST to trigger an initial, historical calendar sync
calendarRouter.post('/sync-initial', async (req, res) => {
  try {
    if (!isAuthenticatedUser(req.user)) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Validate request body
    const bodyResult = calendarSyncRequestSchema.safeParse(req.body);
    if (!bodyResult.success) {
      return res.status(400).json({
        error: 'Invalid sync request data',
        details: bodyResult.error.errors
      });
    }

    const { months, useFreeModel } = bodyResult.data;

    const result = await calendarService.runInitialSync(req.user, months, useFreeModel);
    res.json({
      success: true,
      message: `Historical sync completed. Found ${result.totalEvents} total events, processed ${result.relevantEvents} relevant events.`,
      ...result,
    });
  } catch (error) {
    logError('Historical calendar sync error:', error);
    res
      .status(500)
      .json(createErrorResponse('Failed to sync historical calendar data', error, true));
  }
});

// POST to trigger an ongoing, recent calendar sync
calendarRouter.post('/sync', async (req, res) => {
  try {
    if (!isAuthenticatedUser(req.user)) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const result = await calendarService.runOngoingSync(req.user);
    res.json({
      success: true,
      message: `Sync completed. Processed ${result.relevantEvents} relevant events from ${result.newEvents} new events.`,
      ...result,
    });
  } catch (error) {
    logError('Calendar sync error:', error);
    res.status(500).json(createErrorResponse('Failed to sync calendar', error, true));
  }
});

// GET statistics about the calendar sync state
calendarRouter.get('/sync-stats', async (req, res) => {
  try {
    if (!isAuthenticatedUser(req.user)) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const stats = await calendarService.getSyncStats(req.user.id);
    res.json(stats);
  } catch (error) {
    logError('Sync stats error:', error);
    res.status(500).json(createErrorResponse('Failed to get sync statistics', error, true));
  }
});

// GET a count of unprocessed calendar events
calendarRouter.get('/unprocessed-count', async (req, res) => {
  try {
    if (!isAuthenticatedUser(req.user)) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const count = await calendarService.getUnprocessedCount(req.user.id);
    res.json(count);
  } catch (error) {
    logError('Failed to get unprocessed events count', error);
    res
      .status(500)
      .json(createErrorResponse('Failed to get unprocessed events count', error, true));
  }
});

export default calendarRouter;
