import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { body, param, validationResult } from 'express-validator';
import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import path from 'path';

// CSRF Token Management
class CSRFTokenManager {
  private secret: string;

  constructor() {
    this.secret = process.env.CSRF_SECRET || crypto.randomBytes(32).toString('hex');
  }

  generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  verifyToken(token: string, sessionToken: string): boolean {
    return token === sessionToken;
  }
}

export const csrfTokenManager = new CSRFTokenManager();

// Rate Limiting Configurations
export const createRateLimit = (windowMs: number, max: number, message?: string) => {
  return rateLimit({
    windowMs,
    max,
    message: message || 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });
};

// Different rate limits for different endpoints
export const generalRateLimit = createRateLimit(15 * 60 * 1000, 100); // 100 requests per 15 minutes
export const authRateLimit = createRateLimit(15 * 60 * 1000, 5); // 5 login attempts per 15 minutes
export const apiRateLimit = createRateLimit(1 * 60 * 1000, 60); // 60 API requests per minute
export const uploadRateLimit = createRateLimit(15 * 60 * 1000, 10); // 10 uploads per 15 minutes
export const aiRateLimit = createRateLimit(1 * 60 * 1000, 20); // 20 AI requests per minute

// Extend session type
declare module 'express-session' {
  interface SessionData {
    csrfToken?: string;
  }
}

// CSRF Protection Middleware
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  // Skip CSRF for GET requests and API endpoints that don't modify data
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  // Skip CSRF for OAuth callbacks
  if (req.path.includes('/auth/google') || req.path.includes('/auth/callback')) {
    return next();
  }

  const token = req.headers['x-csrf-token'] as string || req.body._csrf;
  const sessionToken = req.session?.csrfToken;

  if (!token || !sessionToken || !csrfTokenManager.verifyToken(token, sessionToken)) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }

  next();
};

// Generate CSRF token endpoint
export const generateCSRFToken = (req: Request, res: Response) => {
  const token = csrfTokenManager.generateToken();
  if (req.session) {
    req.session.csrfToken = token;
  }
  res.json({ csrfToken: token });
};

// Path Validation Middleware
export const validatePath = (req: Request, res: Response, next: NextFunction) => {
  const { path: filePath } = req.params;
  
  if (!filePath) {
    return next();
  }

  // Prevent path traversal attacks
  const normalizedPath = path.normalize(filePath);
  if (normalizedPath.includes('..') || normalizedPath.startsWith('/')) {
    return res.status(400).json({ error: 'Invalid file path' });
  }

  // Only allow specific file extensions
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
  const ext = path.extname(normalizedPath).toLowerCase();
  if (ext && !allowedExtensions.includes(ext)) {
    return res.status(400).json({ error: 'Invalid file type' });
  }

  next();
};

// Input Validation Rules
export const validateContactId = [
  param('id').isUUID().withMessage('Invalid contact ID format'),
];

export const validateContactCreation = [
  body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Name must be 1-100 characters'),
  body('email').optional().isEmail().withMessage('Invalid email format'),
  body('phone').optional().isMobilePhone('any').withMessage('Invalid phone number'),
];

export const validateInteractionCreation = [
  body('contactId').isUUID().withMessage('Invalid contact ID'),
  body('type').isIn(['email', 'call', 'meeting', 'note']).withMessage('Invalid interaction type'),
  body('content').trim().isLength({ min: 1, max: 5000 }).withMessage('Content must be 1-5000 characters'),
];

export const validateEmailSend = [
  body('to').isEmail().withMessage('Invalid recipient email'),
  body('subject').trim().isLength({ min: 1, max: 200 }).withMessage('Subject must be 1-200 characters'),
  body('body').trim().isLength({ min: 1, max: 10000 }).withMessage('Body must be 1-10000 characters'),
];

// Validation Error Handler
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// Security Headers
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable for development
});

// File Upload Security
export const validateFileUpload = (req: Request, res: Response, next: NextFunction) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // Check file size (5MB limit)
  if (req.file.size > 5 * 1024 * 1024) {
    return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
  }

  // Check file type
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedMimeTypes.includes(req.file.mimetype)) {
    return res.status(400).json({ error: 'Invalid file type. Only images are allowed.' });
  }

  next();
};

// Safe File Operations
export const safeFileOperation = (filePath: string, allowedDir: string): boolean => {
  try {
    const normalizedPath = path.normalize(filePath);
    const normalizedAllowedDir = path.normalize(allowedDir);
    
    // Convert to absolute paths for proper comparison
    const absoluteFilePath = path.isAbsolute(normalizedPath) 
      ? normalizedPath 
      : path.resolve(normalizedAllowedDir, normalizedPath);
    const absoluteAllowedDir = path.isAbsolute(normalizedAllowedDir)
      ? normalizedAllowedDir
      : path.resolve(normalizedAllowedDir);
    
    // Ensure the file is within the allowed directory
    return absoluteFilePath.startsWith(absoluteAllowedDir) && 
           !normalizedPath.includes('..');
  } catch (error) {
    // If any error occurs during path operations, deny access
    return false;
  }
};

// API Response Sanitization
export const sanitizeResponse = (data: any): any => {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeResponse);
  }

  const sanitized: any = {};
  for (const [key, value] of Object.entries(data)) {
    // Remove sensitive fields
    if (['password', 'secret', 'token', 'key'].some(sensitive => 
      key.toLowerCase().includes(sensitive))) {
      continue;
    }
    sanitized[key] = sanitizeResponse(value);
  }

  return sanitized;
};
