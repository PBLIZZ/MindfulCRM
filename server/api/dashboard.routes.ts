import { Router } from 'express';
import { dashboardService } from '../services/dashboard.service.js';
import { requireAuth } from '../utils/jwt-auth.js';
import { isAuthenticatedUser } from '../utils/type-guards.js';
import { nullsToUndefined } from '../utils/api-helpers.js';
import { createErrorResponse, logError } from '../utils/error-handling.js';

const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

// GET dashboard stats
dashboardRouter.get('/stats', async (req, res) => {
  try {
    if (!isAuthenticatedUser(req.user)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const stats = await dashboardService.getStats(req.user.id);
    res.json(nullsToUndefined(stats));
  } catch (error: unknown) {
    logError('Dashboard stats error', error);
    res.status(500).json(createErrorResponse('Failed to fetch stats', error, true));
  }
});

export default dashboardRouter;
