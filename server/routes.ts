import type { Express } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import MemoryStore from "memorystore";
import passport from "./services/auth";
import { storage } from "./storage";
import { syncService } from "./services/sync";
import { aiService } from "./services/openai";
import { z } from "zod";

const MemoryStoreSession = MemoryStore(session);

export async function registerRoutes(app: Express): Promise<Server> {
  // Session configuration
  app.use(session({
    store: new MemoryStoreSession({
      checkPeriod: 86400000 // prune expired entries every 24h
    }),
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));

  // Passport configuration
  app.use(passport.initialize());
  app.use(passport.session());

  // Start sync service
  syncService.start();

  // Auth middleware
  const requireAuth = (req: any, res: any, next: any) => {
    if (req.isAuthenticated()) {
      return next();
    }
    res.status(401).json({ error: 'Authentication required' });
  };

  // Auth routes
  app.get('/auth/google', passport.authenticate('google'));

  app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    (req, res) => {
      res.redirect('/');
    }
  );

  app.post('/api/auth/logout', (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ error: 'Logout failed' });
      }
      res.json({ success: true });
    });
  });

  app.get('/api/auth/user', (req, res) => {
    if (req.isAuthenticated()) {
      res.json(req.user);
    } else {
      res.status(401).json({ error: 'Not authenticated' });
    }
  });

  // Dashboard stats
  app.get('/api/dashboard/stats', requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const stats = await storage.getStats(user.id);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch stats' });
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
        storage.getDocumentsByContactId(contact.id)
      ]);

      res.json({
        ...contact,
        interactions,
        goals,
        documents
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
        storage.getGoalsByContactId(contact.id)
      ]);

      const insights = await aiService.generateInsights({
        contact,
        interactions,
        goals
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
      const syncStatus = await storage.getSyncStatus(user.id);
      res.json(syncStatus);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch sync status' });
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

  const httpServer = createServer(app);
  return httpServer;
}
