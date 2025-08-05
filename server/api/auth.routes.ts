import { Router, type Request, type Response } from 'express';
import passport from '../utils/passport-config.js';
import { requireAuth, setAuthCookie, clearAuthCookie } from '../utils/jwt-auth.js';
import {
  csrfProtection,
  generateCSRFToken,
} from '../utils/security.js';
import { isAuthenticatedUser } from '../utils/type-guards.js';
import { sanitizeResponse } from '../utils/sanitizers.js';
import { nullsToUndefined } from '../utils/api-helpers.js';
import { authService } from '../services/auth.service.js';
import { createErrorResponse, logError } from '../utils/error-handling.js';

const authRouter = Router();

// --- CSRF ---
authRouter.get('/csrf-token', generateCSRFToken);

// --- Google OAuth ---
// Note: These routes will be mounted at /auth/google and /auth/google/callback
// when the router is mounted at root level in index.ts
authRouter.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

authRouter.get(
  '/google/callback',
  (req: Request, res: Response, _next: (error?: Error) => void) => {
    const authenticate = passport.authenticate('google', { 
      failureRedirect: '/login?error=auth_failed', 
      session: false 
    }) as (req: Request, res: Response, next: (err?: Error) => void) => void;
    
    authenticate(req, res, (err?: Error) => {
      if (err) {
        console.error('OAuth callback error:', err);
        return res.redirect('/login?error=oauth_error');
      }
      
      if (!isAuthenticatedUser(req.user)) {
        console.error('User not authenticated after OAuth');
        return res.redirect('/login?error=user_not_found');
      }
      
      try {
        setAuthCookie(res, req.user.id);
        res.redirect('/');
      } catch (cookieError) {
        console.error('Cookie setting error:', cookieError);
        res.redirect('/login?error=cookie_error');
      }
    });
  }
);

// --- Session & Profile Management ---
authRouter.post(
  '/logout',
  csrfProtection,
  (req: Request, res: Response): void => {
    clearAuthCookie(res);
    res.json({ success: true });
  }
);

authRouter.get('/user', requireAuth, (req: Request, res: Response): void => {
  res.json(sanitizeResponse(nullsToUndefined(req.user)));
});

authRouter.get(
  '/profile',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!isAuthenticatedUser(req.user)) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }
      const userProfile = await authService.getUserProfile(req.user.id);
      res.json(nullsToUndefined(userProfile));
    } catch (error: unknown) {
      logError('Profile fetch error', error);
      res.status(500).json(createErrorResponse('Failed to fetch profile', error, true));
    }
  }
);

authRouter.patch(
  '/profile/gdpr-consent',
  csrfProtection,
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!isAuthenticatedUser(req.user)) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { allowProfilePictureScraping, gdprConsentDate, gdprConsentVersion } = req.body as {
        allowProfilePictureScraping: boolean;
        gdprConsentDate: string;
        gdprConsentVersion: string;
      };

      if (
        typeof allowProfilePictureScraping !== 'boolean' ||
        !gdprConsentDate ||
        !gdprConsentVersion
      ) {
        res.status(400).json({ error: 'Missing or invalid consent data' });
        return;
      }

      const consentDate = new Date(gdprConsentDate);
      if (isNaN(consentDate.getTime())) {
        res.status(400).json({ error: 'gdprConsentDate must be a valid date' });
        return;
      }

      const updatedUser = await authService.updateGdprConsent(req.user.id, {
        allowProfilePictureScraping,
        gdprConsentDate: consentDate,
        gdprConsentVersion,
      });
      res.json(nullsToUndefined(updatedUser));
    } catch (error: unknown) {
      logError('GDPR consent update error', error);
      res.status(500).json(createErrorResponse('Failed to update GDPR consent', error, true));
    }
  }
);

export default authRouter;
