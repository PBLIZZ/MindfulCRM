import express from 'express';
import type { Request, Response } from 'express';
import { createServer, type Server } from 'http';
import { isAuthenticatedUser, type AuthenticatedUser } from './utils/type-guards.js';
import { logError, createErrorResponse } from './utils/error-handling.js';

// Extend Express Request interface to include user property
declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthenticatedUser;
  }
}
import cookieParser from 'cookie-parser';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { pool } from './db.js';
import * as path from 'path';
import * as fs from 'fs';
import multer from 'multer';
import sharp from 'sharp';
import passport from './services/auth.js';
import { storage } from './storage.js';
import { syncService } from './services/sync.js';
import { geminiService } from './services/gemini.js';
import { createOpenRouterService } from './services/openrouter.js';
import { rateLimiter } from './services/rate-limiter.js';
import { googleService } from './services/google.js';
import { PhotoEnrichmentService } from './services/photo-enrichment.js';
import { taskAI } from './services/task-ai.js';
import { taskScheduler } from './services/task-scheduler.js';
import { requireAuth, setAuthCookie, clearAuthCookie } from './services/jwt-auth.js';
import {
  generalRateLimit,
  authRateLimit,
  apiRateLimit,
  uploadRateLimit,
  aiRateLimit,
  csrfProtection,
  generateCSRFToken,
  validateContactId,
  validateInteractionCreation,
  handleValidationErrors,
  securityHeaders,
  validateFileUpload,
  safeFileOperation,
  sanitizeResponse,
} from './services/security.js';
import { nullsToUndefined, safeAnalysisData } from './utils/api-helpers.js';
import { z } from 'zod';
import { createContactSchema, updateContactSchema } from './schemas/contact.schemas.js';

export async function registerRoutes(app: express.Application): Promise<Server> {
  // Security headers
  app.use(securityHeaders);

  // General rate limiting
  app.use(generalRateLimit);

  // Serve static files for uploaded photos
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // Cookie parser for JWT tokens
  app.use(cookieParser());

  // Session middleware with PostgreSQL store (fixes critical memory leak)
  const PgStore = connectPgSimple(session);
  const store = new PgStore({
    pool,
    tableName: 'user_sessions', // Name of the session table
    createTableIfMissing: true,
  });

  const SESSION_SECRET = process.env.SESSION_SECRET;
  if (!SESSION_SECRET) {
    throw new Error('SESSION_SECRET environment variable is required for security');
  }

  app.use(
    session({
      store,
      secret: SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      },
    })
  );

  // Passport configuration (for OAuth only)
  app.use(passport.initialize());
  app.use(passport.session());

  // Start sync service and task scheduler
  syncService.start();
  taskScheduler.start();

  // CSRF token endpoint
  app.get('/api/csrf-token', generateCSRFToken);

  // Auth routes with rate limiting
  app.get('/auth/google', authRateLimit, passport.authenticate('google'));

  app.get(
    '/auth/google/callback',
    authRateLimit,
    passport.authenticate('google', { failureRedirect: '/login' }),
    (req: Request, res: Response) => {
      // Set JWT cookie after successful OAuth
      if (!isAuthenticatedUser(req.user)) {
        return res.status(401).json({ error: 'Authentication failed' });
      }
      setAuthCookie(res, req.user.id);
      res.redirect('/');
    }
  );

  app.post('/api/auth/logout', authRateLimit, csrfProtection, (req: Request, res: Response) => {
    clearAuthCookie(res);
    res.json({ success: true });
  });

  app.get('/api/auth/user', apiRateLimit, requireAuth, (req: Request, res: Response) => {
    res.json(sanitizeResponse(req.user));
  });

  // Profile management
  app.get('/api/profile', apiRateLimit, requireAuth, async (req: Request, res: Response) => {
    try {
      if (!isAuthenticatedUser(req.user)) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      const user = req.user;
      const userProfile = await storage.getUserById(user.id);
      console.log('Profile fetch successful:', {
        userId: user.id,
        allowProfilePictureScraping: userProfile?.allowProfilePictureScraping,
        hasProfile: !!userProfile,
      });
      res.json(nullsToUndefined(userProfile));
    } catch (error: unknown) {
      console.error('Profile fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch profile' });
    }
  });

  app.patch(
    '/api/profile/gdpr-consent',
    apiRateLimit,
    csrfProtection,
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        if (!isAuthenticatedUser(req.user)) {
          return res.status(401).json({ error: 'User not authenticated' });
        }
        const user = req.user;
        const { allowProfilePictureScraping, gdprConsentDate, gdprConsentVersion } = req.body as {
          allowProfilePictureScraping: boolean;
          gdprConsentDate: string;
          gdprConsentVersion: string;
        };

        console.log('GDPR consent update request:', {
          userId: user.id,
          allowProfilePictureScraping,
          gdprConsentDate,
          gdprConsentVersion,
        });

        // Validate required fields
        if (typeof allowProfilePictureScraping !== 'boolean') {
          return res.status(400).json({ error: 'allowProfilePictureScraping must be a boolean' });
        }

        if (!gdprConsentDate) {
          return res.status(400).json({ error: 'gdprConsentDate is required' });
        }

        if (!gdprConsentVersion) {
          return res.status(400).json({ error: 'gdprConsentVersion is required' });
        }

        // Parse and validate the date
        const consentDate = new Date(gdprConsentDate);
        if (isNaN(consentDate.getTime())) {
          return res.status(400).json({ error: 'gdprConsentDate must be a valid date' });
        }

        const updatedUser = await storage.updateUserGdprConsent(user.id, {
          allowProfilePictureScraping,
          gdprConsentDate: consentDate,
          gdprConsentVersion,
        });

        console.log('GDPR consent update successful:', updatedUser.allowProfilePictureScraping);
        res.json(nullsToUndefined(updatedUser));
      } catch (error: unknown) {
        logError('GDPR consent update error', error);
        res.status(500).json(createErrorResponse('Failed to update GDPR consent', error, true));
      }
    }
  );

  // Dashboard stats
  app.get('/api/dashboard/stats', requireAuth, async (req: Request, res: Response) => {
    try {
      if (!isAuthenticatedUser(req.user)) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const user = req.user!; // Safe after type guard check
      console.log('Fetching stats for user:', user.id);
      const stats = await storage.getStats(user.id);
      res.json(nullsToUndefined(stats));
    } catch (error: unknown) {
      logError('Dashboard stats error', error);
      res.status(500).json(createErrorResponse('Failed to fetch stats', error, true));
    }
  });

  // Contacts
  app.get('/api/contacts', apiRateLimit, requireAuth, async (req: Request, res: Response) => {
    try {
      if (!isAuthenticatedUser(req.user)) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const user = req.user!; // Safe after type guard check
      const contacts = await storage.getContactsByUserId(user.id);
      res.json(sanitizeResponse(contacts));
    } catch (error: unknown) {
      logError('Failed to fetch contacts', error);
      res.status(500).json(createErrorResponse('Failed to fetch contacts', error, true));
    }
  });

  app.get(
    '/api/contacts/:id',
    apiRateLimit,
    requireAuth,
    validateContactId,
    handleValidationErrors,
    async (req: Request, res: Response) => {
      try {
        const contact = await storage.getContact(req.params.id);
        if (!contact) {
          return res.status(404).json({ error: 'Contact not found' });
        }

        const [interactions, goals, documents] = await Promise.all([
          storage.getInteractionsByContactId(contact.id),
          storage.getGoalsByContactId(contact.id),
          storage.getDocumentsByContactId(contact.id),
        ]);

        res.json(
          nullsToUndefined(
            sanitizeResponse({
              ...contact,
              interactions,
              goals,
              documents,
            })
          )
        );
      } catch (error: unknown) {
        logError('Failed to fetch contact details', error);
        res.status(500).json(createErrorResponse('Failed to fetch contact details', error, true));
      }
    }
  );

  app.post(
    '/api/contacts',
    apiRateLimit,
    csrfProtection,
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        // 1. Validate and get typed data using Zod schema
        const contactData = createContactSchema.parse(req.body);
        if (!isAuthenticatedUser(req.user)) {
          return res.status(401).json({ error: 'User not authenticated' });
        }
        const user = req.user;

        // 2. Use the validated data with userId
        const contact = await storage.createContact({ ...contactData, userId: user.id });
        res.json(nullsToUndefined(sanitizeResponse(contact)));
      } catch (error: unknown) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({
            error: 'Validation failed',
            details: error.errors,
          });
        }
        console.error('Contact creation error:', error);
        res.status(500).json({ error: 'Failed to create contact' });
      }
    }
  );

  app.patch(
    '/api/contacts/:id',
    apiRateLimit,
    csrfProtection,
    requireAuth,
    validateContactId,
    handleValidationErrors,
    async (req: Request, res: Response) => {
      try {
        // 1. Extract tags separately from the request body
        const { tags, ...requestBody } = req.body as { tags?: unknown[]; [key: string]: unknown };

        // 2. Validate and get typed data using Zod schema
        const contactData = updateContactSchema.parse(requestBody);

        // 3. Update the basic contact information
        await storage.updateContact(req.params.id, contactData);

        // Handle tags if provided
        if (tags && Array.isArray(tags)) {
          // Get current contact to see what tags it has
          const currentContact = await storage.getContact(req.params.id);
          const currentTags = currentContact?.tags ?? [];

          // Remove all current tags from this contact
          for (const currentTag of currentTags) {
            await storage.removeTagFromContact(req.params.id, currentTag.id);
          }

          // Get all existing tags for reference
          const existingTags = await storage.getAllTags();

          // Then add the new tags
          for (const tag of tags) {
            const typedTag = tag as { id: string; name: string; color?: string };
            let tagId = typedTag.id;

            // If it's a temporary tag (starts with 'temp_'), create it first
            if (typedTag.id.startsWith('temp_')) {
              // Check if a tag with this name already exists
              const existingTag = existingTags.find(
                (t) => t.name.toLowerCase() === typedTag.name.toLowerCase()
              );
              if (existingTag) {
                tagId = existingTag.id;
              } else {
                // Create new tag
                const newTag = await storage.createTag({
                  name: typedTag.name,
                  color: typedTag.color ?? '#3b82f6',
                });
                tagId = newTag.id;
              }
            }

            // Add tag to contact (only if not already present)
            try {
              await storage.addTagToContact(req.params.id, tagId);
            } catch (error: unknown) {
              // Ignore duplicate key errors - tag already exists for this contact
              const errorMessage = error instanceof Error ? error.message : String(error);
              if (!errorMessage.includes('duplicate') && !errorMessage.includes('unique')) {
                throw error;
              }
            }
          }
        }

        // Return the updated contact with tags
        const updatedContact = await storage.getContact(req.params.id);
        res.json(nullsToUndefined(sanitizeResponse(updatedContact)));
      } catch (error: unknown) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({
            error: 'Validation failed',
            details: error.errors,
          });
        }
        console.error('Contact update error:', error);
        res.status(500).json({ error: 'Failed to update contact' });
      }
    }
  );

  app.delete(
    '/api/contacts/:id',
    apiRateLimit,
    csrfProtection,
    requireAuth,
    validateContactId,
    handleValidationErrors,
    async (req: Request, res: Response) => {
      try {
        const success = await storage.deleteContact(req.params.id);
        if (success) {
          res.json({ success: true });
        } else {
          res.status(404).json({ error: 'Contact not found' });
        }
      } catch (error: unknown) {
        console.error('Failed to delete contact:', error);
        res.status(500).json({
          error: 'Failed to delete contact',
          ...(process.env.NODE_ENV === 'development' && {
            details: error instanceof Error ? error.message : 'Unknown error',
          }),
        });
      }
    }
  );

  app.get('/api/contacts/:id/cascade-info', requireAuth, async (req: Request, res: Response) => {
    try {
      const contactId = req.params.id;
      const [interactions, goals, documents, calendarEvents] = await Promise.all([
        storage.getInteractionsByContactId(contactId),
        storage.getGoalsByContactId(contactId),
        storage.getDocumentsByContactId(contactId),
        storage.getCalendarEventsByContactId(contactId),
      ]);

      res.json({
        interactions: interactions.length,
        goals: goals.length,
        documents: documents.length,
        calendarEvents: calendarEvents.length,
      });
    } catch {
      res.status(500).json({ error: 'Failed to get cascade info' });
    }
  });

  // Configure multer for file uploads
  const uploadDir = path.join(process.cwd(), 'uploads', 'contact-photos');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const upload = multer({
    dest: 'temp/',
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed'));
      }
    },
  });

  // Photo upload endpoint
  app.post(
    '/api/contacts/upload-photo',
    uploadRateLimit,
    csrfProtection,
    requireAuth,
    upload.single('image'),
    validateFileUpload,
    async (req: Request, res: Response) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: 'No image file provided' });
        }

        const contactId = (req.body as { contactId: string }).contactId;
        if (!contactId) {
          return res.status(400).json({ error: 'Contact ID is required' });
        }

        // Verify contact exists
        const contact = await storage.getContact(contactId);
        if (!contact) {
          // Clean up uploaded file safely
          if (safeFileOperation(req.file.path, 'temp/')) {
            fs.unlinkSync(req.file.path);
          }
          return res.status(404).json({ error: 'Contact not found' });
        }

        // Generate unique filename with safe characters
        const safeContactId = contactId.replace(/[^a-zA-Z0-9-_]/g, '');
        const fileName = `${safeContactId}_${Date.now()}.webp`;
        const outputPath = path.join(uploadDir, fileName);

        // Validate output path is safe
        if (!safeFileOperation(outputPath, uploadDir)) {
          if (safeFileOperation(req.file.path, 'temp/')) {
            fs.unlinkSync(req.file.path);
          }
          return res.status(400).json({ error: 'Invalid file path' });
        }

        // Process image with Sharp: convert to WebP, resize, and optimize
        await sharp(req.file.path)
          .resize(400, 400, {
            fit: 'cover',
            position: 'center',
          })
          .webp({ quality: 85 })
          .toFile(outputPath);

        // Clean up temp file safely
        if (safeFileOperation(req.file.path, 'temp/')) {
          fs.unlinkSync(req.file.path);
        }

        // Check final file size
        const stats = fs.statSync(outputPath);
        if (stats.size > 250 * 1024) {
          // 250KB
          // Re-process with lower quality if still too large
          const tempPath = outputPath + '.tmp';
          await sharp(outputPath).webp({ quality: 60 }).toFile(tempPath);

          if (safeFileOperation(tempPath, uploadDir)) {
            fs.renameSync(tempPath, outputPath);
          }
        }

        // Create contact photo record
        const photoRecord = await storage.createContactPhoto({
          contactId,
          fileName,
          filePath: `/uploads/contact-photos/${fileName}`,
          fileSize: fs.statSync(outputPath).size,
          mimeType: 'image/webp',
          source: 'manual',
          isActive: true,
        });

        // Update contact avatar URL
        const avatarUrl = `/uploads/contact-photos/${fileName}`;
        await storage.updateContact(contactId, { avatarUrl });

        res.json({
          success: true,
          avatarUrl,
          photoId: photoRecord.id,
          fileSize: photoRecord.fileSize,
        });
      } catch (error: unknown) {
        console.error('Photo upload error:', error);

        // Clean up uploaded file if it exists
        if (req.file && fs.existsSync(req.file.path) && safeFileOperation(req.file.path, 'temp/')) {
          fs.unlinkSync(req.file.path);
        }

        res.status(500).json({
          error: 'Failed to upload photo',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  // AI photo download endpoint
  app.post(
    '/api/contacts/ai-photo-download',
    aiRateLimit,
    csrfProtection,
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        // TODO: Implement AI photo download and processing
        res.status(501).json({ error: 'AI photo download not yet implemented' });
      } catch {
        res.status(500).json({ error: 'Failed to download photo' });
      }
    }
  );

  // Remove contact photo
  app.delete(
    '/api/contacts/:id/photo',
    apiRateLimit,
    csrfProtection,
    requireAuth,
    validateContactId,
    handleValidationErrors,
    async (req: Request, res: Response) => {
      try {
        const success = await storage.updateContact(req.params.id, {
          avatarUrl: null,
        });
        if (success) {
          res.json({ success: true });
        } else {
          res.status(404).json({ error: 'Contact not found' });
        }
      } catch (error: unknown) {
        console.error('Failed to delete photo:', error);
        res.status(500).json({
          error: 'Failed to delete photo',
          ...(process.env.NODE_ENV === 'development' && {
            details: error instanceof Error ? error.message : 'Unknown error',
          }),
        });
      }
    }
  );

  // Photo Enrichment Service
  const photoEnrichmentService = new PhotoEnrichmentService(storage);

  // Batch enrich all contact photos
  app.post(
    '/api/photo-enrichment/batch',
    aiRateLimit,
    csrfProtection,
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        if (!isAuthenticatedUser(req.user)) {
          return res.status(401).json({ error: 'User not authenticated' });
        }
        const user = req.user;
        const results = await photoEnrichmentService.batchEnrichPhotos(user.id);
        res.json(sanitizeResponse(results));
      } catch (error: unknown) {
        console.error('Batch photo enrichment error:', error);
        res.status(500).json({
          error: 'Failed to batch enrich photos',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  // Find photo suggestions for a single contact
  app.get(
    '/api/contacts/:id/photo-suggestions',
    apiRateLimit,
    requireAuth,
    validateContactId,
    handleValidationErrors,
    async (req: Request, res: Response) => {
      try {
        const contact = await storage.getContact(req.params.id);
        if (!contact) {
          return res.status(404).json({ error: 'Contact not found' });
        }

        // Convert database contact to ContactInfo format
        const contactInfo = {
          id: contact.id,
          name: contact.name,
          email: contact.email,
          phone: contact.phone ?? null, // Keep null as null, convert undefined to null
          allowProfilePictureScraping: contact.hasGdprConsent ?? undefined, // Convert null to undefined
          // Add other fields if available from JSON fields
          company:
            contact.extractedFields && typeof contact.extractedFields === 'object'
              ? (contact.extractedFields as { company?: string }).company
              : undefined,
          linkedinUrl:
            contact.socialMediaHandles && typeof contact.socialMediaHandles === 'object'
              ? (contact.socialMediaHandles as { linkedin?: string }).linkedin
              : undefined,
          jobTitle:
            contact.extractedFields && typeof contact.extractedFields === 'object'
              ? (contact.extractedFields as { jobTitle?: string }).jobTitle
              : undefined,
        };

        const suggestions = await photoEnrichmentService.findPhotoSuggestions(contactInfo);
        res.json({ suggestions });
      } catch (error: unknown) {
        console.error('Photo suggestions error:', error);
        res.status(500).json({ error: 'Failed to find photo suggestions' });
      }
    }
  );

  // Enrich a single contact's photo
  app.post(
    '/api/contacts/:id/enrich-photo',
    aiRateLimit,
    csrfProtection,
    requireAuth,
    validateContactId,
    handleValidationErrors,
    async (req: Request, res: Response) => {
      try {
        const result = await photoEnrichmentService.enrichSingleContact(req.params.id);
        res.json(sanitizeResponse(result));
      } catch (error: unknown) {
        console.error('Single photo enrichment error:', error);
        res.status(500).json({ error: 'Failed to enrich contact photo' });
      }
    }
  );

  // Get enrichment stats
  app.get(
    '/api/photo-enrichment/stats',
    apiRateLimit,
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        if (!isAuthenticatedUser(req.user)) {
          return res.status(401).json({ error: 'User not authenticated' });
        }
        const user = req.user;
        const contacts = await storage.getContactsByUserId(user.id);

        const stats = {
          totalContacts: contacts.length,
          contactsWithPhotos: contacts.filter((c) => c.avatarUrl).length,
          contactsConsented: contacts.filter((c) => c.hasGdprConsent).length,
          contactsEligible: contacts.filter((c) => c.hasGdprConsent && !c.avatarUrl).length,
        };

        res.json(sanitizeResponse(stats));
      } catch (error: unknown) {
        console.error('Photo enrichment stats error:', error);
        res.status(500).json({ error: 'Failed to fetch enrichment stats' });
      }
    }
  );

  // Export contacts
  app.get(
    '/api/contacts/export',
    apiRateLimit,
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        if (!isAuthenticatedUser(req.user)) {
          return res.status(401).json({ error: 'User not authenticated' });
        }
        const user = req.user;
        const format = (req.query.format as string) ?? 'json';
        const contacts = await storage.getContactsByUserId(user.id);

        if (format === 'json') {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Content-Disposition', 'attachment; filename="contacts.json"');
          res.json(contacts);
        } else if (format === 'csv') {
          // TODO: Implement CSV export
          res.status(501).json({ error: 'CSV export not yet implemented' });
        } else {
          res.status(400).json({ error: 'Unsupported format' });
        }
      } catch {
        res.status(500).json({ error: 'Failed to export contacts' });
      }
    }
  );

  // Export selected contacts
  app.post('/api/contacts/export-selected', requireAuth, async (req: Request, res: Response) => {
    try {
      const { contactIds, format } = req.body as { contactIds: string[]; format: string };
      const contacts = await Promise.all(contactIds.map((id: string) => storage.getContact(id)));
      const validContacts = contacts.filter(Boolean);

      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="selected-contacts.json"');
        res.json(validContacts);
      } else {
        res.status(400).json({ error: 'Unsupported format' });
      }
    } catch {
      res.status(500).json({ error: 'Failed to export selected contacts' });
    }
  });

  // Recent interactions
  app.get(
    '/api/interactions/recent',
    apiRateLimit,
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        if (!isAuthenticatedUser(req.user)) {
          return res.status(401).json({ error: 'User not authenticated' });
        }
        const user = req.user;
        const limit = Math.min(parseInt(req.query.limit as string) || 10, 100); // Cap at 100
        const interactions = await storage.getRecentInteractions(user.id, limit);
        res.json(sanitizeResponse(interactions));
      } catch {
        res.status(500).json({ error: 'Failed to fetch recent interactions' });
      }
    }
  );

  // Create interaction
  app.post(
    '/api/interactions',
    apiRateLimit,
    csrfProtection,
    requireAuth,
    validateInteractionCreation,
    handleValidationErrors,
    async (req: Request, res: Response) => {
      try {
        console.log('Creating interaction with data:', req.body);
        const interactionData = {
          ...req.body,
          timestamp: new Date(req.body.timestamp),
        };
        const interaction = await storage.createInteraction(interactionData);
        res.json(interaction);
      } catch (error: unknown) {
        console.error('Create interaction error:', error);
        res.status(500).json({
          error: 'Failed to create interaction',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  // Get contact calendar context
  app.get(
    '/api/contacts/:contactId/calendar-context',
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        if (!isAuthenticatedUser(req.user)) {
          return res.status(401).json({ error: 'User not authenticated' });
        }
        const user = req.user;
        const { contactId } = req.params;

        // Get calendar events for this contact
        const events = await storage.getCalendarEventsByContactId(contactId);

        const now = new Date();
        const lastEvent = events
          .filter((event) => event.startTime && new Date(event.startTime) < now)
          .sort((a, b) => new Date(b.startTime!).getTime() - new Date(a.startTime!).getTime())[0];

        const nextEvent = events
          .filter((event) => event.startTime && new Date(event.startTime) > now)
          .sort((a, b) => new Date(a.startTime!).getTime() - new Date(b.startTime!).getTime())[0];

        const last90Days = events.filter((event) => {
          if (!event.startTime) return false;
          const eventDate = new Date(event.startTime);
          const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          return eventDate >= ninetyDaysAgo && eventDate <= now;
        });

        res.json({
          lastEvent,
          nextEvent,
          sessionCount90Days: last90Days.length,
          totalSessions: events.length,
        });
      } catch (error: unknown) {
        console.error('Error fetching contact calendar context:', error);
        res.status(500).json({ error: 'Failed to fetch calendar context' });
      }
    }
  );

  // Goals
  app.post('/api/goals', requireAuth, async (req: Request, res: Response) => {
    try {
      const goal = await storage.createGoal(req.body);
      res.json(goal);
    } catch (error: unknown) {
      res.status(500).json({ error: 'Failed to create goal' });
    }
  });

  app.patch('/api/goals/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const goal = await storage.updateGoal(req.params.id, req.body);
      res.json(goal);
    } catch (error: unknown) {
      res.status(500).json({ error: 'Failed to update goal' });
    }
  });

  // AI Assistant
  app.post(
    '/api/ai/chat',
    aiRateLimit,
    csrfProtection,
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { message, context } = req.body;
        const response = await geminiService.generateChatResponse(message, context);
        res.json(sanitizeResponse({ response }));
      } catch (error: unknown) {
        res.status(500).json({ error: 'Failed to generate AI response' });
      }
    }
  );

  app.post(
    '/api/ai/insights/:contactId',
    aiRateLimit,
    csrfProtection,
    requireAuth,
    validateContactId,
    handleValidationErrors,
    async (req: Request, res: Response) => {
      try {
        const contact = await storage.getContact(req.params.contactId);
        if (!contact) {
          return res.status(404).json({ error: 'Contact not found' });
        }

        const [interactions, goals] = await Promise.all([
          storage.getInteractionsByContactId(contact.id),
          storage.getGoalsByContactId(contact.id),
        ]);

        const openRouterWithStorage = createOpenRouterService(storage);

        // Transform contact data to match ContactData interface
        const contactData = {
          id: contact.id,
          name: contact.name,
          email: contact.email,
          phone: contact.phone,
          avatarUrl: contact.avatarUrl,
          status: contact.status,
          lifecycleStage: contact.lifecycleStage,
          userId: contact.userId,
          createdAt: contact.createdAt,
          updatedAt: contact.updatedAt,
          lastContact: contact.lastContact,
          sentiment: contact.sentiment,
          interactions,
          goals,
        } as any; // Cast as any since ContactData interface doesn't include interactions/goals

        const insights = await openRouterWithStorage.generateInsights(contactData);

        res.json(nullsToUndefined(insights));
      } catch (error: unknown) {
        res.status(500).json({ error: 'Failed to generate insights' });
      }
    }
  );

  // Sync
  app.get('/api/sync/status', apiRateLimit, requireAuth, async (req: Request, res: Response) => {
    try {
      if (!isAuthenticatedUser(req.user)) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      const user = req.user;
      console.log('Fetching sync status for user:', user.id);
      const syncStatus = await storage.getSyncStatus(user.id);
      res.json(sanitizeResponse(syncStatus));
    } catch (error: unknown) {
      console.error('Sync status error:', error);
      res.status(500).json({
        error: 'Failed to fetch sync status',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  app.post(
    '/api/sync/manual',
    apiRateLimit,
    csrfProtection,
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        if (!isAuthenticatedUser(req.user)) {
          return res.status(401).json({ error: 'User not authenticated' });
        }
        const user = req.user;
        await syncService.manualSync(user.id);
        res.json({ success: true });
      } catch (error: unknown) {
        res.status(500).json({ error: 'Manual sync failed' });
      }
    }
  );
  // Calendar Events
  app.get('/api/calendar/events', requireAuth, async (req: Request, res: Response) => {
    try {
      if (!isAuthenticatedUser(req.user)) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      const user = req.user;
      const month = req.query.month as string;

      // Get all events for the user
      const allEvents = await storage.getCalendarEventsByUserId(user.id);

      // Filter by month if specified
      let events = allEvents;
      if (month) {
        const targetDate = new Date(month);
        const targetYear = targetDate.getFullYear();
        const targetMonth = targetDate.getMonth();

        events = allEvents.filter((event) => {
          if (!event.startTime) return false;
          const eventDate = new Date(event.startTime);
          return eventDate.getFullYear() === targetYear && eventDate.getMonth() === targetMonth;
        });
      }

      res.json(events);
    } catch (error: unknown) {
      res.status(500).json({ error: 'Failed to fetch calendar events' });
    }
  });

  // Get upcoming calendar events for dashboard
  app.get('/api/calendar/upcoming', requireAuth, async (req: Request, res: Response) => {
    try {
      if (!isAuthenticatedUser(req.user)) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      const user = req.user;
      const limit = parseInt(req.query.limit as string) || 5;

      // Get all events for the user
      const allEvents = await storage.getCalendarEventsByUserId(user.id, 100);

      // Filter for future events and sort by start time
      const now = new Date();
      const upcomingEvents = allEvents
        .filter((event) => event.startTime && new Date(event.startTime) > now)
        .sort((a, b) => new Date(a.startTime!).getTime() - new Date(b.startTime!).getTime())
        .slice(0, limit);

      res.json(upcomingEvents);
    } catch (error: unknown) {
      console.error('Error fetching upcoming events:', error);
      res.status(500).json({ error: 'Failed to fetch upcoming events' });
    }
  });

  app.post('/api/calendar/events', requireAuth, async (req: Request, res: Response) => {
    try {
      if (!isAuthenticatedUser(req.user)) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      const user = req.user;
      const eventData = { ...req.body, userId: user.id };
      const event = await storage.createCalendarEvent(eventData);
      res.json(event);
    } catch (error: unknown) {
      res.status(500).json({ error: 'Failed to create calendar event' });
    }
  });

  app.post('/api/calendar/sync', requireAuth, async (req: Request, res: Response) => {
    try {
      if (!isAuthenticatedUser(req.user)) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      const user = req.user;
      console.log(`Starting ongoing calendar sync for user ${user.id}`);

      // Sync only recent changes (last 7 days + future events)
      await syncService.syncCalendar(user.id);

      // Process new events with intelligent model selection
      const openRouterWithStorage = createOpenRouterService(storage);
      const contacts = await storage.getContactsByUserId(user.id);
      const unprocessedEvents = await storage.getUnprocessedCalendarEvents(user.id);

      if (unprocessedEvents.length > 0) {
        console.log(`Processing ${unprocessedEvents.length} new events`);

        // For ongoing sync, use premium model for better accuracy
        const results = await openRouterWithStorage.processCalendarEvents(
          unprocessedEvents,
          contacts,
          user.id,
          false
        );

        // Mark processed events
        for (const event of unprocessedEvents) {
          const result = results.find((r) => r.eventId === event.id);
          await storage.markCalendarEventProcessed(
            event.id,
            result || ({} as Record<string, unknown>)
          );
        }

        // Get updated usage stats
        const usageStats = await rateLimiter.getUsageStats(user.id);

        res.json({
          success: true,
          message: `Sync completed. Processed ${results.length} relevant events from ${unprocessedEvents.length} new events.`,
          newEvents: unprocessedEvents.length,
          relevantEvents: results.length,
          usageStats,
          recommendations: usageStats.recommendations,
        });
      } else {
        res.json({
          success: true,
          message: 'Sync completed. No new events to process.',
        });
      }
    } catch (error: unknown) {
      console.error('Calendar sync error:', error);
      res.status(500).json({ error: 'Failed to sync calendar' });
    }
  });

  // Enhanced Calendar Routes for Raw Google Data
  app.get('/api/calendar/raw-events', requireAuth, async (req: Request, res: Response) => {
    try {
      if (!isAuthenticatedUser(req.user)) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      const user = req.user;
      const limit = parseInt(req.query.limit as string) || 100;
      const events = await storage.getCalendarEventsByUserId(user.id, limit);
      res.json(events);
    } catch (error: unknown) {
      res.status(500).json({ error: 'Failed to fetch raw calendar events' });
    }
  });

  app.post('/api/calendar/sync-initial', requireAuth, async (req: Request, res: Response) => {
    try {
      if (!isAuthenticatedUser(req.user)) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      const user = req.user;
      const { months = 12, useFreeModel = true } = req.body; // Default to 1 year, use free model for bulk

      console.log(`Starting initial ${months}-month calendar sync for user ${user.id}`);

      // Validate months parameter
      if (months < 1 || months > 24) {
        return res.status(400).json({ error: 'Months must be between 1 and 24' });
      }

      // Calculate date range for initial sync
      const now = new Date();
      const startDate = new Date(now.getTime() - months * 30 * 24 * 60 * 60 * 1000);
      const endDate = new Date(now.getTime() + 6 * 30 * 24 * 60 * 60 * 1000); // 6 months forward

      // Sync historical data with custom date range
      await googleService.syncCalendar(user, {
        startDate,
        endDate,
        syncType: 'initial',
      });

      // Process events with intelligent rate limiting and model selection
      const openRouterWithStorage = createOpenRouterService(storage);
      const contacts = await storage.getContactsByUserId(user.id);
      const events = await storage.getUnprocessedCalendarEvents(user.id);

      // Get usage stats and recommendations
      const usageStats = await rateLimiter.getUsageStats(user.id);
      console.log('Current usage stats:', usageStats);

      // Process in batches with rate limiting
      const batchSize = 25; // Smaller batches for better rate limit management
      let processedCount = 0;

      for (let i = 0; i < events.length; i += batchSize) {
        const batch = events.slice(i, i + batchSize);
        console.log(
          `Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(
            events.length / batchSize
          )}`
        );

        const results = await openRouterWithStorage.processCalendarEvents(
          batch,
          contacts,
          user.id,
          useFreeModel
        );
        processedCount += results.length;

        // Mark processed events in calendar_events table
        for (const event of batch) {
          await storage.markCalendarEventProcessed(
            event.id,
            safeAnalysisData(results.find((r) => r.eventId === event.id))
          );
        }
      }

      res.json({
        success: true,
        message: `Historical sync completed. Processed ${processedCount} relevant events from ${events.length} total events.`,
        totalEvents: events.length,
        relevantEvents: processedCount,
        monthsProcessed: months,
      });
    } catch (error: unknown) {
      console.error('Historical calendar sync error:', error);
      res.status(500).json({ error: 'Failed to sync historical calendar data' });
    }
  });

  app.post('/api/calendar/process-events', requireAuth, async (req: Request, res: Response) => {
    try {
      if (!isAuthenticatedUser(req.user)) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      const user = req.user;
      const { usePremiumModel = true, batchSize = 25 } = req.body;

      console.log(`Starting intelligent LLM processing for user ${user.id}`);

      const openRouterWithStorage = createOpenRouterService(storage);
      const contacts = await storage.getContactsByUserId(user.id);
      const events = await storage.getUnprocessedCalendarEvents(user.id);

      if (events.length === 0) {
        return res.json({
          success: true,
          message: 'No unprocessed events found',
        });
      }

      // Check current usage and get recommendations
      const _usageStats = await rateLimiter.getUsageStats(user.id);

      let processedCount = 0;

      // Process in smaller batches for ongoing processing
      for (let i = 0; i < events.length; i += batchSize) {
        const batch = events.slice(i, i + batchSize);
        console.log(
          `Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(
            events.length / batchSize
          )}`
        );

        const results = await openRouterWithStorage.processCalendarEvents(
          batch,
          contacts,
          user.id,
          !usePremiumModel
        );
        processedCount += results.length;

        // Mark processed events
        for (const event of batch) {
          await storage.markCalendarEventProcessed(
            event.id,
            safeAnalysisData(results.find((r) => r.eventId === event.id))
          );
        }
      }

      res.json({
        success: true,
        message: `Event processing completed. Processed ${processedCount} relevant events from ${events.length} total events.`,
        totalEvents: events.length,
        relevantEvents: processedCount,
        modelUsed: usePremiumModel ? 'qwen3-235b' : 'llama-3.1-8b-free',
      });
    } catch (error: unknown) {
      console.error('Event processing error:', error);
      res.status(500).json({ error: 'Failed to process calendar events' });
    }
  });

  app.get('/api/calendar/unprocessed-count', requireAuth, async (req: Request, res: Response) => {
    try {
      if (!isAuthenticatedUser(req.user)) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      const user = req.user;
      const events = await storage.getUnprocessedCalendarEvents(user.id);
      res.json({ count: events.length });
    } catch (_error: unknown) {
      res.status(500).json({ error: 'Failed to get unprocessed events count' });
    }
  });

  app.get('/api/calendar/sync-stats', requireAuth, async (req: Request, res: Response) => {
    try {
      if (!isAuthenticatedUser(req.user)) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      const user = req.user;

      // Get total events
      const allEvents = await storage.getCalendarEventsByUserId(user.id, 1000);
      const unprocessedEvents = await storage.getUnprocessedCalendarEvents(user.id);

      // Calculate date ranges
      const now = new Date();
      const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Filter events by date ranges
      const eventsLastYear = allEvents.filter(
        (e) => e.startTime && new Date(e.startTime) >= oneYearAgo
      );
      const eventsLastMonth = allEvents.filter(
        (e) => e.startTime && new Date(e.startTime) >= oneMonthAgo
      );
      const futureEvents = allEvents.filter((e) => e.startTime && new Date(e.startTime) > now);

      res.json({
        totalEvents: allEvents.length,
        processedEvents: allEvents.length - unprocessedEvents.length,
        unprocessedEvents: unprocessedEvents.length,
        eventsLastYear: eventsLastYear.length,
        eventsLastMonth: eventsLastMonth.length,
        futureEvents: futureEvents.length,
        oldestEvent: allEvents.length > 0 ? allEvents[allEvents.length - 1]?.startTime : null,
        newestEvent: allEvents.length > 0 ? allEvents[0]?.startTime : null,
      });
    } catch (error: unknown) {
      console.error('Sync stats error:', error);
      res.status(500).json({ error: 'Failed to get sync statistics' });
    }
  });

  // Rate limiting and usage stats endpoint
  app.get('/api/rate-limit/usage', requireAuth, async (req: Request, res: Response) => {
    try {
      if (!isAuthenticatedUser(req.user)) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      const user = req.user;
      const usageStats = await rateLimiter.getUsageStats(user.id);
      res.json(usageStats);
    } catch (error: unknown) {
      console.error('Usage stats error:', error);
      res.status(500).json({ error: 'Failed to get usage statistics' });
    }
  });

  // Get model recommendations
  app.post('/api/rate-limit/recommend', requireAuth, async (req: Request, res: Response) => {
    try {
      const { eventCount, isHistoricalSync } = req.body as {
        eventCount?: number;
        isHistoricalSync?: boolean;
      };
      const recommendedModel = rateLimiter.getRecommendedModel(
        eventCount ?? 0,
        isHistoricalSync ?? false
      );

      res.json({
        recommendedModel,
        isFreeModel: recommendedModel.includes('free'),
        reason:
          isHistoricalSync || eventCount > 50
            ? 'Free model recommended for bulk processing to manage costs'
            : 'Premium model recommended for better accuracy on smaller batches',
      });
    } catch (error: unknown) {
      console.error('Model recommendation error:', error);
      res.status(500).json({ error: 'Failed to get model recommendation' });
    }
  });

  // Email Data Processing (for AI insights, not email management)
  app.get(
    '/api/emails/processed',
    apiRateLimit,
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        if (!isAuthenticatedUser(req.user)) {
          return res.status(401).json({ error: 'User not authenticated' });
        }
        const user = req.user;
        const limit = Math.min(parseInt(req.query.limit as string) ?? 50, 200); // Cap at 200
        const emails = await storage.getEmailsByUserId(user.id, limit);
        // Only return processed emails with extracted data
        const processedEmails = emails.filter((email) => email.processed && email.extractedData);
        res.json(sanitizeResponse(processedEmails));
      } catch (_error: unknown) {
        res.status(500).json({ error: 'Failed to fetch processed emails' });
      }
    }
  );

  app.get(
    '/api/emails/unprocessed',
    apiRateLimit,
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        if (!isAuthenticatedUser(req.user)) {
          return res.status(401).json({ error: 'User not authenticated' });
        }
        const user = req.user;
        const emails = await storage.getUnprocessedEmails(user.id);
        res.json(sanitizeResponse(emails));
      } catch (_error: unknown) {
        res.status(500).json({ error: 'Failed to fetch unprocessed emails' });
      }
    }
  );

  app.patch(
    '/api/emails/:id/mark-processed',
    apiRateLimit,
    csrfProtection,
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { extractedData, relevanceScore, filterReason } = req.body as {
          extractedData?: unknown;
          relevanceScore?: number;
          filterReason?: string;
        };
        const email = await storage.markEmailProcessed(req.params.id, {
          extractedData,
          relevanceScore,
          filterReason,
        });
        res.json(sanitizeResponse(email));
      } catch (_error: unknown) {
        res.status(500).json({ error: 'Failed to mark email as processed' });
      }
    }
  );

  app.post(
    '/api/emails/sync',
    apiRateLimit,
    csrfProtection,
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        if (!isAuthenticatedUser(req.user)) {
          return res.status(401).json({ error: 'User not authenticated' });
        }
        const user = req.user;
        await syncService.syncEmails(user.id);
        res.json({ success: true });
      } catch (_error: unknown) {
        res.status(500).json({ error: 'Failed to sync emails' });
      }
    }
  );

  // Tags
  app.get('/api/tags', requireAuth, async (req: Request, res: Response) => {
    try {
      const tags = await storage.getAllTags();
      res.json(tags);
    } catch (_error: unknown) {
      res.status(500).json({ error: 'Failed to fetch tags' });
    }
  });

  app.post('/api/tags', requireAuth, async (req: Request, res: Response) => {
    try {
      const { name, color } = req.body as {
        name?: string;
        color?: string;
      };
      console.log('Creating tag:', { name, color });

      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Tag name is required' });
      }

      const tag = await storage.createTag({
        name: name.trim(),
        color: color ?? '#3b82f6',
      });
      console.log('Tag created successfully:', tag);
      res.json(tag);
    } catch (error: unknown) {
      console.error('Tag creation error:', error);

      // Handle specific database errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('duplicate') || errorMessage.includes('unique')) {
        return res.status(409).json({ error: 'A tag with this name already exists' });
      }

      res.status(500).json({ error: 'Failed to create tag' });
    }
  });

  app.post('/api/contacts/bulk/add-tag', requireAuth, async (req: Request, res: Response) => {
    try {
      const { contactIds, tagId, tagName, tagColor } = req.body;

      let finalTagId = tagId;

      // Create new tag if tagName is provided but no tagId
      if (!tagId && tagName) {
        const newTag = await storage.createTag({
          name: tagName,
          color: tagColor ?? '#3b82f6',
        });
        finalTagId = newTag.id;
      }

      if (!finalTagId) {
        return res.status(400).json({ error: 'Tag ID or tag name is required' });
      }

      const contactTags = await storage.addTagToContacts(contactIds, finalTagId);
      res.json({ success: true, contactTags, tagId: finalTagId });
    } catch (error: unknown) {
      console.error('Bulk add tag error:', error);
      res.status(500).json({ error: 'Failed to add tag to contacts' });
    }
  });

  app.post('/api/contacts/bulk/remove-tag', requireAuth, async (req: Request, res: Response) => {
    try {
      const { contactIds, tagId } = req.body;
      const success = await storage.removeTagFromContacts(contactIds, tagId);
      res.json({ success });
    } catch (error: unknown) {
      res.status(500).json({ error: 'Failed to remove tag from contacts' });
    }
  });

  // ===== TASK MANAGEMENT API ROUTES =====

  // Projects
  app.get('/api/projects', requireAuth, async (req: Request, res: Response) => {
    try {
      if (!isAuthenticatedUser(req.user)) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      const user = req.user;
      const projects = await storage.getProjectsByUserId(user.id);
      res.json(projects);
    } catch (error: unknown) {
      console.error('Get projects error:', error);
      res.status(500).json({ error: 'Failed to fetch projects' });
    }
  });

  app.post('/api/projects', requireAuth, async (req: Request, res: Response) => {
    try {
      if (!isAuthenticatedUser(req.user)) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      const user = req.user;
      const projectData = { ...req.body, userId: user.id };
      const project = await storage.createProject(projectData);
      res.json(project);
    } catch (error: unknown) {
      console.error('Create project error:', error);
      res.status(500).json({ error: 'Failed to create project' });
    }
  });

  app.patch('/api/projects/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const project = await storage.updateProject(req.params.id, req.body);
      res.json(project);
    } catch (error: unknown) {
      console.error('Update project error:', error);
      res.status(500).json({ error: 'Failed to update project' });
    }
  });

  app.delete('/api/projects/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const success = await storage.deleteProject(req.params.id);
      res.json({ success });
    } catch (error: unknown) {
      console.error('Delete project error:', error);
      res.status(500).json({ error: 'Failed to delete project' });
    }
  });

  // Tasks
  app.get('/api/tasks', requireAuth, async (req: Request, res: Response) => {
    try {
      if (!isAuthenticatedUser(req.user)) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      const user = req.user;
      const { status, project, owner } = req.query;

      let tasks;
      if (project) {
        tasks = await storage.getTasksByProjectId(project as string);
      } else if (status && owner) {
        // Validate enum values
        const validStatuses = [
          'pending',
          'in_progress',
          'completed',
          'cancelled',
          'waiting_approval',
        ] as const;
        const validOwners = ['user', 'ai_assistant'] as const;

        const statusStr = status as string;
        const ownerStr = owner as string;

        if (!validStatuses.includes(statusStr as (typeof validStatuses)[number])) {
          return res
            .status(400)
            .json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
        }

        if (!validOwners.includes(ownerStr as (typeof validOwners)[number])) {
          return res
            .status(400)
            .json({ error: `Invalid owner. Must be one of: ${validOwners.join(', ')}` });
        }

        tasks = await storage.getTasksByStatus(
          statusStr as (typeof validStatuses)[number],
          ownerStr as (typeof validOwners)[number]
        );
      } else {
        const statuses = status ? (status as string).split(',') : undefined;
        tasks = await storage.getTasksByUserId(user.id, statuses);
      }

      res.json(tasks);
    } catch (error: unknown) {
      console.error('Get tasks error:', error);
      res.status(500).json({ error: 'Failed to fetch tasks' });
    }
  });

  app.get('/api/tasks/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const task = await storage.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      // Get subtasks and activities
      const [subtasks, activities] = await Promise.all([
        storage.getSubtasks(task.id),
        storage.getTaskActivities(task.id),
      ]);

      res.json({ ...task, subtasks, activities });
    } catch (error: unknown) {
      console.error('Get task error:', error);
      res.status(500).json({ error: 'Failed to fetch task' });
    }
  });

  app.post('/api/tasks', requireAuth, async (req: Request, res: Response) => {
    try {
      if (!isAuthenticatedUser(req.user)) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      const user = req.user;
      const requestBody = req.body as {
        title?: string;
        description?: string;
        priority?: 'low' | 'medium' | 'high' | 'urgent';
        owner?: 'user' | 'ai_assistant';
        dueDate?: string;
        projectId?: string;
        assignedContactIds?: string[];
      };

      // Ensure required fields are provided
      if (!requestBody.title) {
        return res.status(400).json({ error: 'Title is required' });
      }

      const { dueDate, ...restRequestBody } = requestBody;
      const taskData = {
        ...restRequestBody,
        userId: user.id,
        title: requestBody.title,
        dueDate: dueDate ? new Date(dueDate) : undefined,
      };

      const task = await storage.createTask(taskData);

      // Create activity log for task creation
      await storage.createTaskActivity({
        taskId: task.id,
        actorType: 'user',
        actorId: user.id,
        actionType: 'created',
        description: `Task created: ${task.title}`,
        metadata: { priority: task.priority, owner: task.owner },
      });

      res.json(task);
    } catch (error: unknown) {
      console.error('Create task error:', error);
      res.status(500).json({ error: 'Failed to create task' });
    }
  });

  app.patch('/api/tasks/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      if (!isAuthenticatedUser(req.user)) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      const user = req.user;
      const updates = req.body as {
        title?: string;
        description?: string;
        status?: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'waiting_approval';
        priority?: 'low' | 'medium' | 'high' | 'urgent';
        completedAt?: string | Date;
        dueDate?: string;
        [key: string]: unknown;
      };

      // Convert string dates to Date objects if provided
      const processedUpdates = {
        ...updates,
        dueDate: updates.dueDate ? new Date(updates.dueDate) : undefined,
        completedAt: updates.completedAt ? new Date(updates.completedAt) : undefined,
      };

      const task = await storage.updateTask(req.params.id, processedUpdates);

      // Create activity log for task update
      const activityDescription = Object.keys(updates)
        .map((key) => {
          const value = updates[key];
          if (key === 'status') return `Status changed to ${String(value)}`;
          if (key === 'priority') return `Priority changed to ${String(value)}`;
          if (key === 'completedAt' && value) return 'Task completed';
          return `${key} updated`;
        })
        .join(', ');

      await storage.createTaskActivity({
        taskId: task.id,
        actorType: 'user',
        actorId: user.id,
        actionType: 'updated',
        description: activityDescription,
        metadata: updates as Record<string, unknown>,
      });

      res.json(task);
    } catch (error: unknown) {
      console.error('Update task error:', error);
      res.status(500).json({ error: 'Failed to update task' });
    }
  });

  app.delete('/api/tasks/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const success = await storage.deleteTask(req.params.id);
      res.json({ success });
    } catch (error: unknown) {
      console.error('Delete task error:', error);
      res.status(500).json({ error: 'Failed to delete task' });
    }
  });

  // Task delegation to AI
  app.post('/api/tasks/delegate-to-ai', requireAuth, async (req: Request, res: Response) => {
    try {
      if (!isAuthenticatedUser(req.user)) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      const user = req.user;
      const requestBody = req.body as {
        title?: string;
        description?: string;
        contactIds?: string[];
        dueDate?: string;
        projectId?: string;
        priority?: 'low' | 'medium' | 'high' | 'urgent';
      };
      const { title, description, contactIds, dueDate, projectId, priority } = requestBody;

      const task = await taskAI.delegateTaskToAI(user.id, {
        title: title ?? '',
        description: description ?? '',
        contactIds: contactIds ?? [],
        dueDate: dueDate ? new Date(dueDate) : undefined,
        projectId: projectId ?? undefined,
        priority: (priority as 'low' | 'medium' | 'high' | 'urgent') ?? 'medium',
      });

      res.json({
        success: true,
        task,
        message: 'Task successfully delegated to AI assistant. Processing will begin shortly.',
      });
    } catch (error: unknown) {
      console.error('Delegate task to AI error:', error);
      res.status(500).json({ error: 'Failed to delegate task to AI' });
    }
  });

  // Bulk task creation from contacts
  app.post('/api/tasks/bulk-create', requireAuth, async (req: Request, res: Response) => {
    try {
      if (!isAuthenticatedUser(req.user)) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      const user = req.user;
      const requestBody = req.body as {
        title?: string;
        description?: string;
        contactIds?: string[];
        dueDate?: string;
        projectId?: string;
        owner?: string;
      };
      const { title, description, contactIds, dueDate, projectId, owner } = requestBody;

      if (owner === 'ai_assistant') {
        // Delegate to AI for processing
        const task = await taskAI.delegateTaskToAI(user.id, {
          title: title ?? '',
          description: description ?? '',
          contactIds: contactIds ?? [],
          dueDate: dueDate ? new Date(dueDate) : undefined,
          projectId: projectId ?? undefined,
        });

        res.json({
          success: true,
          task,
          message: 'Bulk task delegated to AI for processing',
        });
      } else {
        // Create regular user task
        const task = await storage.createTask({
          userId: user.id,
          title: title ?? '',
          description: description ?? '',
          assignedContactIds: contactIds ?? [],
          dueDate: dueDate ? new Date(dueDate) : undefined,
          projectId: projectId ?? undefined,
          owner: 'user',
        });

        const contactCount = contactIds?.length ?? 0;
        await storage.createTaskActivity({
          taskId: task.id,
          actorType: 'user',
          actorId: user.id,
          actionType: 'created',
          description: `Bulk task created for ${contactCount} contacts`,
          metadata: { contactCount },
        });

        res.json({ success: true, task });
      }
    } catch (error: unknown) {
      console.error('Bulk create task error:', error);
      res.status(500).json({ error: 'Failed to create bulk task' });
    }
  });

  // AI Suggestions
  app.get('/api/ai-suggestions', requireAuth, async (req: Request, res: Response) => {
    try {
      if (!isAuthenticatedUser(req.user)) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      const user = req.user;
      const { status } = req.query;

      const suggestions = await storage.getAiSuggestionsByUserId(user.id, status as string);
      res.json(suggestions);
    } catch (error: unknown) {
      console.error('Get AI suggestions error:', error);
      res.status(500).json({ error: 'Failed to fetch AI suggestions' });
    }
  });

  app.patch('/api/ai-suggestions/:id/approve', requireAuth, async (req: Request, res: Response) => {
    try {
      const suggestion = await storage.updateAiSuggestion(req.params.id, {
        status: 'approved',
        reviewedAt: new Date(),
      });

      // Execute the approved suggestion
      const success = await taskAI.executeAISuggestion(req.params.id);

      res.json({
        success,
        suggestion,
        message: success
          ? 'Suggestion approved and executed'
          : 'Suggestion approved but execution failed',
      });
    } catch (error: unknown) {
      console.error('Approve AI suggestion error:', error);
      res.status(500).json({ error: 'Failed to approve AI suggestion' });
    }
  });

  app.patch('/api/ai-suggestions/:id/reject', requireAuth, async (req: Request, res: Response) => {
    try {
      const requestBody = req.body as { reason?: string };
      const { reason } = requestBody;
      const suggestion = await storage.updateAiSuggestion(req.params.id, {
        status: 'rejected',
        reviewedAt: new Date(),
        rejectionReason: reason ?? '',
      });

      res.json({ success: true, suggestion });
    } catch (error: unknown) {
      console.error('Reject AI suggestion error:', error);
      res.status(500).json({ error: 'Failed to reject AI suggestion' });
    }
  });

  // Data Processing and Background Jobs
  app.post(
    '/api/data-processing/attendance-csv',
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        if (!isAuthenticatedUser(req.user)) {
          return res.status(401).json({ error: 'User not authenticated' });
        }
        const user = req.user;
        const requestBody = req.body as { csvData?: string; fileName?: string };
        const { csvData, fileName } = requestBody;

        if (!csvData || !fileName) {
          return res.status(400).json({ error: 'csvData and fileName are required' });
        }

        const suggestions = await taskAI.processAttendanceCSV(user.id, csvData, fileName);

        res.json({
          success: true,
          suggestionsCreated: suggestions.length,
          suggestions,
        });
      } catch (error: unknown) {
        console.error('Process attendance CSV error:', error);
        res.status(500).json({ error: 'Failed to process attendance CSV' });
      }
    }
  );

  app.post('/api/data-processing/photo-gdpr', requireAuth, async (req: Request, res: Response) => {
    try {
      if (!isAuthenticatedUser(req.user)) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      const user = req.user;
      const requestBody = req.body as {
        photoData?: { contactId: string; photoUrl: string; source: string }[];
      };
      const { photoData } = requestBody;

      if (!photoData || !Array.isArray(photoData)) {
        return res.status(400).json({ error: 'photoData array is required' });
      }

      const suggestions = await taskAI.processNewPhotos(user.id, photoData);

      res.json({
        success: true,
        suggestionsCreated: suggestions.length,
        suggestions,
      });
    } catch (error: unknown) {
      console.error('Process photo GDPR error:', error);
      res.status(500).json({ error: 'Failed to process photo data' });
    }
  });

  app.get('/api/data-processing/jobs', requireAuth, async (req: Request, res: Response) => {
    try {
      if (!isAuthenticatedUser(req.user)) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      const user = req.user;
      const jobs = await storage.getDataProcessingJobsByUserId(user.id);
      res.json(jobs);
    } catch (error: unknown) {
      console.error('Get data processing jobs error:', error);
      res.status(500).json({ error: 'Failed to fetch data processing jobs' });
    }
  });

  // Manual trigger for immediate AI analysis
  app.post('/api/ai/trigger-analysis', requireAuth, async (req: Request, res: Response) => {
    try {
      if (!isAuthenticatedUser(req.user)) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      const user = req.user;
      await taskScheduler.triggerImmediateAnalysis(user.id);

      res.json({
        success: true,
        message: 'AI analysis triggered successfully. Check AI suggestions for results.',
      });
    } catch (error: unknown) {
      console.error('Trigger AI analysis error:', error);
      res.status(500).json({ error: 'Failed to trigger AI analysis' });
    }
  });

  // Task analytics and insights
  app.get('/api/tasks/analytics', requireAuth, async (req: Request, res: Response) => {
    try {
      if (!isAuthenticatedUser(req.user)) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      const user = req.user;

      const [allTasks, pendingTasks, completedTasks, aiTasks] = await Promise.all([
        storage.getTasksByUserId(user.id),
        storage.getTasksByUserId(user.id, ['pending']),
        storage.getTasksByUserId(user.id, ['completed']),
        storage.getTasksByStatus('in_progress', 'ai_assistant'),
      ]);

      const overdueTasks = allTasks.filter(
        (task) => task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed'
      );

      const todaysTasks = allTasks.filter(
        (task) =>
          task.dueDate && new Date(task.dueDate).toDateString() === new Date().toDateString()
      );

      const analytics = {
        totalTasks: allTasks.length,
        pendingTasks: pendingTasks.length,
        completedTasks: completedTasks.length,
        overdueTasks: overdueTasks.length,
        todaysTasks: todaysTasks.length,
        aiTasksInProgress: aiTasks.length,
        completionRate:
          allTasks.length > 0 ? ((completedTasks.length / allTasks.length) * 100).toFixed(1) : '0',
        averageCompletionTime: calculateAverageCompletionTime(completedTasks),
      };

      res.json(analytics);
    } catch (error: unknown) {
      console.error('Get task analytics error:', error);
      res.status(500).json({ error: 'Failed to fetch task analytics' });
    }
  });

  // Helper function for task analytics
  interface CompletedTask {
    completedAt?: Date | string | null;
    createdAt?: Date | string | null;
  }

  function calculateAverageCompletionTime(completedTasks: CompletedTask[]): string {
    if (completedTasks.length === 0) return '0 days';

    const totalTime = completedTasks.reduce((sum, task) => {
      if (task.completedAt && task.createdAt) {
        const completedTime = new Date(task.completedAt).getTime();
        const createdTime = new Date(task.createdAt).getTime();
        return sum + (completedTime - createdTime);
      }
      return sum;
    }, 0);

    const avgMilliseconds = totalTime / completedTasks.length;
    const avgDays = Math.round(avgMilliseconds / (1000 * 60 * 60 * 24));

    return `${avgDays} days`;
  }

  const httpServer = createServer(app);
  return httpServer;
}
