import dotenv from 'dotenv';
dotenv.config();

import express, { type Request, type Response, type NextFunction } from 'express';
import { createServer } from 'http';
import * as path from 'path';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import passport from './utils/passport-config.js';
import { pool } from './db.js';
import { syncService as _syncService } from './services/sync.js';
import { taskScheduler as _taskScheduler } from './services/task-scheduler.js';
import { securityHeaders, generalRateLimit } from './utils/security.js';
import apiRouter from './api/index.routes.js';
import { setupVite, serveStatic, log } from './vite.js';
import { logError, createErrorResponse } from './utils/error-handling.js';

const app = express();

// --- Core Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// --- Request Logging Middleware (preserved from original file) ---
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, unknown> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson: unknown) {
    capturedJsonResponse = bodyJson as Record<string, unknown>;
    return originalResJson.call(res, bodyJson);
  };

  res.on('finish', () => {
    const duration = Date.now() - start;
    if (path.startsWith('/api')) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + '…';
      }
      log(logLine);
    }
  });

  next();
});

// --- Security, Session, and Auth Middleware (moved from old routes.ts) ---
app.use(securityHeaders);
app.use(generalRateLimit); // Re-enabled with higher limit for testing
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use(cookieParser());

const PgStore = connectPgSimple(session);
const store = new PgStore({
  pool,
  tableName: 'user_sessions',
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

app.use(passport.initialize());
app.use(passport.session());

// --- Auth Routes at Root Level ---
// Mount auth routes at root to handle /auth/google paths
import authRouter from './api/auth.routes.js';
app.use('/auth', authRouter);

// --- Main API Router ---
// This replaces the old call to registerRoutes(app)
app.use('/api', apiRouter);

void (async () => {
  try {
    // Background services - DISABLED FOR DEVELOPMENT
    // syncService.start();
    // taskScheduler.start();
    log('Background services disabled for development');

    const server = createServer(app);

    // Vite/static setup (preserved from original file)
    if (app.get('env') === 'development') {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Global Error handling middleware (preserved from original file)
    app.use(
      (
        err: Error & { status?: number; statusCode?: number },
        _req: Request,
        res: Response,
        _next: NextFunction
      ) => {
        logError('Global error handler caught:', err);
        const response = createErrorResponse(
          'An unexpected error occurred',
          err,
          process.env.NODE_ENV !== 'production'
        );
        const statusCode = err.statusCode ?? err.status ?? 500;
        res.status(statusCode).json(response);
      }
    );

    // Server listen (preserved from original file)
    const port = parseInt(process.env.PORT ?? '8080', 10);
    server.listen(port, () => {
      log(`serving on port ${port}`);
    });
  } catch (err) {
    logError('Failed to start server', err);
    process.exit(1);
  }
})();
