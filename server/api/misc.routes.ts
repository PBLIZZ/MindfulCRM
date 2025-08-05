import { Router } from 'express';
import { requireAuth } from '../utils/jwt-auth.js';
import { storage } from '../data/index.js';
import { syncService } from '../services/sync.js';
import { isAuthenticatedUser } from '../utils/type-guards.js';
import { apiRateLimit, csrfProtection } from '../utils/security.js';
import { sanitizeResponse } from '../utils/sanitizers.js';
import { createErrorResponse, logError } from '../utils/error-handling.js';

const miscRouter = Router();

miscRouter.use(requireAuth);

// --- Sync Status ---
miscRouter.get('/sync/status', apiRateLimit, async (req, res) => {
  try {
    if (!isAuthenticatedUser(req.user)) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const syncStatus = await storage.misc.getSyncStatus(req.user.id);
    res.json(sanitizeResponse(syncStatus));
  } catch (error: unknown) {
    logError('Sync status error:', error);
    res.status(500).json(createErrorResponse('Failed to fetch sync status', error, true));
  }
});

miscRouter.post('/sync/manual', apiRateLimit, csrfProtection, async (req, res) => {
  try {
    if (!isAuthenticatedUser(req.user)) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    await syncService.manualSync(req.user.id);
    res.json({ success: true, message: 'Manual sync initiated.' });
  } catch (error: unknown) {
    logError('Manual sync failed', error);
    res.status(500).json(createErrorResponse('Manual sync failed', error, true));
  }
});

// --- Email Data ---
miscRouter.get('/emails/processed', apiRateLimit, async (req, res) => {
  try {
    if (!isAuthenticatedUser(req.user)) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const limit = Math.min(parseInt(req.query.limit as string) ?? 50, 200); // Cap at 200
    const emails = await storage.emails.getByUserId(req.user.id, limit);
    // Only return processed emails with extracted data
    const processedEmails = emails.filter((email) => email.processed && email.extractedData);
    res.json(sanitizeResponse(processedEmails));
  } catch (error: unknown) {
    logError('Failed to fetch processed emails', error);
    res.status(500).json(createErrorResponse('Failed to fetch processed emails', error, true));
  }
});

miscRouter.get('/emails/unprocessed', apiRateLimit, async (req, res) => {
  try {
    if (!isAuthenticatedUser(req.user)) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const emails = await storage.emails.getUnprocessed(req.user.id);
    res.json(sanitizeResponse(emails));
  } catch (error: unknown) {
    logError('Failed to fetch unprocessed emails', error);
    res.status(500).json(createErrorResponse('Failed to fetch unprocessed emails', error, true));
  }
});

miscRouter.patch('/emails/:id/mark-processed', apiRateLimit, csrfProtection, async (req, res) => {
  try {
    if (!isAuthenticatedUser(req.user)) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const { extractedData, relevanceScore, filterReason } = req.body as {
      extractedData?: unknown;
      relevanceScore?: number;
      filterReason?: string;
    };
    const email = await storage.emails.markProcessed(req.params.id, {
      extractedData,
      relevanceScore,
      filterReason,
    });
    res.json(sanitizeResponse(email));
  } catch (error: unknown) {
    logError('Failed to mark email as processed', error);
    res.status(500).json(createErrorResponse('Failed to mark email as processed', error, true));
  }
});

miscRouter.post('/emails/sync', apiRateLimit, csrfProtection, async (req, res) => {
  try {
    if (!isAuthenticatedUser(req.user)) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    await syncService.syncEmails(req.user.id);
    res.json({ success: true, message: 'Email sync initiated successfully.' });
  } catch (error: unknown) {
    logError('Email sync failed', error);
    res.status(500).json(createErrorResponse('Email sync failed', error, true));
  }
});

export default miscRouter;
