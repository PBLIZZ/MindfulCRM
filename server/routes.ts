import type { Express } from 'express';
import { createServer, type Server } from 'http';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import passport from './services/auth';
import { storage } from './storage';
import { syncService } from './services/sync';
import { aiService } from './services/openai';
import { googleService } from './services/google';
import { llmProcessor } from './services/llm-processor';
import { requireAuth, optionalAuth, setAuthCookie, clearAuthCookie } from './services/jwt-auth';
import { z } from 'zod';

export async function registerRoutes(app: Express): Promise<Server> {
  // Cookie parser for JWT tokens
  app.use(cookieParser());

  // Session middleware (only needed for Passport OAuth flow)
  app.use(session({
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 10 * 60 * 1000 // 10 minutes - just for OAuth flow
    }
  }));

  // Passport configuration (for OAuth only)
  app.use(passport.initialize());
  app.use(passport.session());

  // Start sync service
  syncService.start();

  // Auth routes
  app.get('/auth/google', passport.authenticate('google'));

  app.get(
    '/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    (req, res) => {
      // Set JWT cookie after successful OAuth
      const user = req.user as any;
      if (user) {
        setAuthCookie(res, user.id);
      }
      res.redirect('/');
    }
  );

  app.post('/api/auth/logout', (req, res) => {
    clearAuthCookie(res);
    res.json({ success: true });
  });

  app.get('/api/auth/user', requireAuth, (req, res) => {
    res.json(req.user);
  });

  // Dashboard stats
  app.get('/api/dashboard/stats', requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      console.log('Fetching stats for user:', user.id);
      const stats = await storage.getStats(user.id);
      res.json(stats);
    } catch (error) {
      console.error('Dashboard stats error:', error);
      res.status(500).json({ error: 'Failed to fetch stats', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Contacts
  app.get('/api/contacts', requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const contacts = await storage.getContactsByUserId(user.id);
      res.json(contacts);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch contacts' });
    }
  });

  app.get('/api/contacts/:id', requireAuth, async (req, res) => {
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

      res.json({
        ...contact,
        interactions,
        goals,
        documents,
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch contact details' });
    }
  });

  app.post('/api/contacts', requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const contactData = { ...req.body, userId: user.id };
      const contact = await storage.createContact(contactData);
      res.json(contact);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create contact' });
    }
  });

  app.patch('/api/contacts/:id', requireAuth, async (req, res) => {
    try {
      const contact = await storage.updateContact(req.params.id, req.body);
      res.json(contact);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update contact' });
    }
  });

  app.delete('/api/contacts/:id', requireAuth, async (req, res) => {
    try {
      const success = await storage.deleteContact(req.params.id);
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: 'Contact not found' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete contact' });
    }
  });

  app.get('/api/contacts/:id/cascade-info', requireAuth, async (req, res) => {
    try {
      const contactId = req.params.id;
      const [interactions, goals, documents, voiceNotes, photos, calendarEvents] = await Promise.all([
        storage.getInteractionsByContactId(contactId),
        storage.getGoalsByContactId(contactId),
        storage.getDocumentsByContactId(contactId),
        [], // Voice notes - TODO: implement if needed
        [], // Photos - TODO: implement
        storage.getCalendarEventsByContactId(contactId),
      ]);

      res.json({
        interactions: interactions.length,
        goals: goals.length,
        documents: documents.length,
        voiceNotes: 0,
        photos: 0,
        calendarEvents: calendarEvents.length,
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get cascade info' });
    }
  });

  // Photo upload endpoint
  app.post('/api/contacts/upload-photo', requireAuth, async (req, res) => {
    try {
      // TODO: Implement file upload with multer and image processing
      res.status(501).json({ error: 'Photo upload not yet implemented' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to upload photo' });
    }
  });

  // AI photo download endpoint
  app.post('/api/contacts/ai-photo-download', requireAuth, async (req, res) => {
    try {
      // TODO: Implement AI photo download and processing
      res.status(501).json({ error: 'AI photo download not yet implemented' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to download photo' });
    }
  });

  // Remove contact photo
  app.delete('/api/contacts/:id/photo', requireAuth, async (req, res) => {
    try {
      const success = await storage.updateContact(req.params.id, { avatarUrl: null });
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: 'Contact not found' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to remove photo' });
    }
  });

  // Export contacts
  app.get('/api/contacts/export', requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const format = req.query.format as string || 'json';
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
    } catch (error) {
      res.status(500).json({ error: 'Failed to export contacts' });
    }
  });

  // Export selected contacts
  app.post('/api/contacts/export-selected', requireAuth, async (req, res) => {
    try {
      const { contactIds, format } = req.body;
      const contacts = await Promise.all(
        contactIds.map((id: string) => storage.getContact(id))
      );
      const validContacts = contacts.filter(Boolean);
      
      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="selected-contacts.json"');
        res.json(validContacts);
      } else {
        res.status(400).json({ error: 'Unsupported format' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to export selected contacts' });
    }
  });

  // Recent interactions
  app.get('/api/interactions/recent', requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const limit = parseInt(req.query.limit as string) || 10;
      const interactions = await storage.getRecentInteractions(user.id, limit);
      res.json(interactions);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch recent interactions' });
    }
  });

  // Create interaction
  app.post('/api/interactions', requireAuth, async (req, res) => {
    try {
      console.log('Creating interaction with data:', req.body);
      const interactionData = {
        ...req.body,
        timestamp: new Date(req.body.timestamp)
      };
      const interaction = await storage.createInteraction(interactionData);
      res.json(interaction);
    } catch (error) {
      console.error('Create interaction error:', error);
      res.status(500).json({ error: 'Failed to create interaction', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Get contact calendar context
  app.get('/api/contacts/:contactId/calendar-context', requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const { contactId } = req.params;
      
      // Get calendar events for this contact
      const events = await storage.getCalendarEventsByContactId(contactId);
      
      const now = new Date();
      const lastEvent = events
        .filter(event => event.startTime && new Date(event.startTime) < now)
        .sort((a, b) => new Date(b.startTime!).getTime() - new Date(a.startTime!).getTime())[0];
      
      const nextEvent = events
        .filter(event => event.startTime && new Date(event.startTime) > now)
        .sort((a, b) => new Date(a.startTime!).getTime() - new Date(b.startTime!).getTime())[0];
      
      const last90Days = events.filter(event => {
        if (!event.startTime) return false;
        const eventDate = new Date(event.startTime);
        const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        return eventDate >= ninetyDaysAgo && eventDate <= now;
      });
      
      res.json({
        lastEvent,
        nextEvent,
        sessionCount90Days: last90Days.length,
        totalSessions: events.length
      });
    } catch (error) {
      console.error('Error fetching contact calendar context:', error);
      res.status(500).json({ error: 'Failed to fetch calendar context' });
    }
  });

  // Goals
  app.post('/api/goals', requireAuth, async (req, res) => {
    try {
      const goal = await storage.createGoal(req.body);
      res.json(goal);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create goal' });
    }
  });

  app.patch('/api/goals/:id', requireAuth, async (req, res) => {
    try {
      const goal = await storage.updateGoal(req.params.id, req.body);
      res.json(goal);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update goal' });
    }
  });

  // AI Assistant
  app.post('/api/ai/chat', requireAuth, async (req, res) => {
    try {
      const { message, context } = req.body;
      const response = await aiService.generateChatResponse(message, context);
      res.json({ response });
    } catch (error) {
      res.status(500).json({ error: 'Failed to generate AI response' });
    }
  });

  app.post('/api/ai/insights/:contactId', requireAuth, async (req, res) => {
    try {
      const contact = await storage.getContact(req.params.contactId);
      if (!contact) {
        return res.status(404).json({ error: 'Contact not found' });
      }

      const [interactions, goals] = await Promise.all([
        storage.getInteractionsByContactId(contact.id),
        storage.getGoalsByContactId(contact.id),
      ]);

      const insights = await aiService.generateInsights({
        contact,
        interactions,
        goals,
      });

      res.json(insights);
    } catch (error) {
      res.status(500).json({ error: 'Failed to generate insights' });
    }
  });

  // Sync
  app.get('/api/sync/status', requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      console.log('Fetching sync status for user:', user.id);
      const syncStatus = await storage.getSyncStatus(user.id);
      res.json(syncStatus);
    } catch (error) {
      console.error('Sync status error:', error);
      res.status(500).json({ error: 'Failed to fetch sync status', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/api/sync/manual', requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      await syncService.manualSync(user.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Manual sync failed' });
    }
  });
  // Calendar Events
  app.get('/api/calendar/events', requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const month = req.query.month as string;
      const events = await storage.getCalendarEvents(user.id, month);
      res.json(events);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch calendar events' });
    }
  });

  // Get upcoming calendar events for dashboard
  app.get('/api/calendar/upcoming', requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const limit = parseInt(req.query.limit as string) || 5;
      
      // Get all events for the user
      const allEvents = await storage.getCalendarEventsByUserId(user.id, 100);
      
      // Filter for future events and sort by start time
      const now = new Date();
      const upcomingEvents = allEvents
        .filter(event => event.startTime && new Date(event.startTime) > now)
        .sort((a, b) => new Date(a.startTime!).getTime() - new Date(b.startTime!).getTime())
        .slice(0, limit);
      
      res.json(upcomingEvents);
    } catch (error) {
      console.error('Error fetching upcoming events:', error);
      res.status(500).json({ error: 'Failed to fetch upcoming events' });
    }
  });

  app.post('/api/calendar/events', requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const eventData = { ...req.body, userId: user.id };
      const event = await storage.createCalendarEvent(eventData);
      res.json(event);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create calendar event' });
    }
  });

  app.post('/api/calendar/sync', requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      await syncService.syncCalendar(user.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to sync calendar' });
    }
  });

  // Enhanced Calendar Routes for Raw Google Data
  app.get('/api/calendar/raw-events', requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const limit = parseInt(req.query.limit as string) || 100;
      const events = await storage.getCalendarEventsByUserId(user.id, limit);
      res.json(events);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch raw calendar events' });
    }
  });

  app.post('/api/calendar/sync-90-days', requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      console.log(`Starting 90-day calendar sync for user ${user.id}`);
      await googleService.syncCalendar(user);
      res.json({ success: true, message: 'Calendar sync completed' });
    } catch (error) {
      console.error('90-day calendar sync error:', error);
      res.status(500).json({ error: 'Failed to sync 90-day calendar data' });
    }
  });

  app.post('/api/calendar/process-events', requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      console.log(`Starting LLM processing for user ${user.id}`);
      await llmProcessor.processCalendarEvents(user);
      res.json({ success: true, message: 'Event processing completed' });
    } catch (error) {
      console.error('Event processing error:', error);
      res.status(500).json({ error: 'Failed to process calendar events' });
    }
  });

  app.get('/api/calendar/unprocessed-count', requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const events = await storage.getUnprocessedCalendarEvents(user.id);
      res.json({ count: events.length });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get unprocessed events count' });
    }
  });

  // Email Management
  app.get('/api/emails/:folder?', requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const folder = req.params.folder || 'inbox';
      const emails = await storage.getEmails(user.id, folder);
      res.json(emails);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch emails' });
    }
  });

  app.post('/api/emails/send', requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const emailData = { ...req.body, fromUserId: user.id };
      const email = await storage.sendEmail(emailData);
      res.json(email);
    } catch (error) {
      res.status(500).json({ error: 'Failed to send email' });
    }
  });

  app.patch('/api/emails/:id/read', requireAuth, async (req, res) => {
    try {
      const success = await storage.markEmailAsRead(req.params.id);
      res.json({ success });
    } catch (error) {
      res.status(500).json({ error: 'Failed to mark email as read' });
    }
  });

  app.patch('/api/emails/:id/star', requireAuth, async (req, res) => {
    try {
      const success = await storage.toggleEmailStar(req.params.id);
      res.json({ success });
    } catch (error) {
      res.status(500).json({ error: 'Failed to toggle email star' });
    }
  });

  app.patch('/api/emails/:id/move', requireAuth, async (req, res) => {
    try {
      const { folder } = req.body;
      const success = await storage.moveEmail(req.params.id, folder);
      res.json({ success });
    } catch (error) {
      res.status(500).json({ error: 'Failed to move email' });
    }
  });

  app.post('/api/emails/sync', requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      await syncService.syncEmails(user.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to sync emails' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
