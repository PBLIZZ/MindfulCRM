# Google OAuth Authentication - Complete Developer Guide

**Last Updated:** August 2025  
**Version:** 1.0  
**Authors:** Development Team

---

## Table of Contents

- [Overview](#overview)
- [Architecture Overview](#architecture-overview)
- [File Structure](#file-structure)
- [Environment Setup](#environment-setup)
- [Server-Side Components](#server-side-components)
- [Client-Side Components](#client-side-components)
- [Authentication Flow](#authentication-flow)
- [Troubleshooting Guide](#troubleshooting-guide)
- [Security Considerations](#security-considerations)
- [Testing](#testing)
- [Common Issues & Solutions](#common-issues--solutions)

---

## Overview

This document provides a comprehensive guide to the Google OAuth authentication system in MindfulCRM. It covers all moving parts, files, functions, and setup required for Google sign-in functionality.

### Key Features

- Google OAuth 2.0 integration using Passport.js
- JWT-based session management
- CSRF protection
- Secure cookie handling
- Client-side authentication state management
- Following DATA_DOCTRINE principles

---

## Architecture Overview

```mermaid
graph TD
    A[User clicks "Sign in with Google"] --> B[Client redirects to /auth/google]
    B --> C[Passport.js initiates OAuth flow]
    C --> D[Google OAuth consent screen]
    D --> E[User authorizes app]
    E --> F[Google redirects to /auth/google/callback]
    F --> G[Passport verifies with Google]
    G --> H[AuthService finds/creates user]
    H --> I[JWT token generated]
    I --> J[Auth cookie set]
    J --> K[Redirect to dashboard]
    K --> L[Client fetches user data]
    L --> M[AuthContext updates state]
```

---

## File Structure

### Server-Side Files

server/
├── services/
│ └── auth.service.ts # Core auth business logic
├── utils/
│ ├── passport-config.ts # Passport OAuth configuration
│ ├── jwt-auth.ts # JWT token management
│ ├── type-guards.ts # User type validation
│ └── security.ts # CSRF & security middleware
├── api/
│ └── auth.routes.ts # Auth HTTP endpoints
├── data/
│ └── user.data.ts # User database operations
└── types/
├── service-contracts.ts # Internal type definitions
└── external-apis.ts # Google API type definitions

### Client-Side Files

client/src/
├── contexts/
│ └── AuthContext.tsx # React auth state management
├── pages/
│ └── Login.tsx # Login page component
├── hooks/
│ └── useAuth.ts # Auth hooks (if any)
└── components/
└── Layout/
└── AuthenticatedRoute.tsx # Protected route wrapper

---

## Environment Setup

### Required Environment Variables

```bash
# Google OAuth Credentials
GOOGLE_OAUTH_CLIENT_ID=your-google-client-id
GOOGLE_OAUTH_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:8080/auth/google/callback

# JWT Configuration
JWT_SECRET=your-jwt-secret-key

# Session Management
SESSION_SECRET=your-session-secret

# Database (for user storage)
DATABASE_URL=your-database-connection-string
```

### Google Cloud Console Setup

1. **Create Project** in Google Cloud Console
2. **Enable APIs**: Google+ API, Gmail API, Calendar API, Drive API
3. **Create OAuth 2.0 Credentials**
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:8080/auth/google/callback`
4. **Configure OAuth Consent Screen**
   - Add required scopes: `profile`, `email`

---

## Server-Side Components

### 1. Auth Service (`server/services/auth.service.ts`)

**Purpose:** Core authentication business logic following service pattern.

```typescript
export class AuthService {
  async getUserProfile(userId: string): Promise<User | undefined>;
  async updateGdprConsent(userId: string, consent: GdprConsent): Promise<User>;
  async findOrCreateGoogleUser(
    profile: GoogleProfile,
    accessToken: string,
    refreshToken: string
  ): Promise<User>;
  async findUserById(userId: string): Promise<User | undefined>;
}
```

**Key Functions:**

- `findOrCreateGoogleUser()`: Handles user creation/lookup during OAuth
- `getUserProfile()`: Retrieves user data for authenticated requests
- `updateGdprConsent()`: Manages GDPR compliance settings

### 2. Passport Configuration (`server/utils/passport-config.ts`)

**Purpose:** Configures Passport.js Google OAuth strategy.

```typescript
passport.use(
  'google',
  new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: CALLBACK_URL,
      scope: ['profile', 'email'],
    },
    authCallbackHandler
  )
);
```

**Key Functions:**

- **OAuth Strategy Setup**: Configures Google OAuth parameters
- **Serialize/Deserialize**: Manages user session data
- **Callback Handler**: Processes Google's OAuth response

### 3. JWT Authentication (`server/utils/jwt-auth.ts`)

**Purpose:** Manages JWT tokens and authentication middleware.

```typescript
export function generateToken(userId: string): string;
export function verifyToken(token: string): { userId: string } | null;
export function setAuthCookie(res: Response, userId: string): void;
export function clearAuthCookie(res: Response): void;
export const requireAuth: RequestHandler;
```

**Key Functions:**

- `generateToken()`: Creates JWT for authenticated users
- `verifyToken()`: Validates JWT tokens
- `setAuthCookie()`: Sets secure HTTP-only auth cookie
- `requireAuth()`: Middleware for protecting routes

### 4. Auth Routes (`server/api/auth.routes.ts`)

**Purpose:** HTTP endpoints for authentication.

```typescript
// OAuth Routes
GET  /auth/google              # Initiate OAuth flow
GET  /auth/google/callback     # OAuth callback handler

// Session Management
GET  /auth/user               # Get current user data
POST /auth/logout             # Logout (with CSRF protection)
GET  /auth/profile            # Get detailed user profile
PATCH /auth/profile/gdpr-consent # Update GDPR settings

// Security
GET  /auth/csrf-token         # Get CSRF token
```

### 5. User Data Layer (`server/data/user.data.ts`)

**Purpose:** Database operations for user management.

```typescript
export class UserData {
  async findById(id: string): Promise<User | undefined>;
  async findByGoogleId(googleId: string): Promise<User | undefined>;
  async create(insertUser: InsertUser): Promise<User>;
  async update(id: string, updates: Partial<InsertUser>): Promise<User>;
  async updateGdprConsent(id: string, consent: GdprConsent): Promise<User>;
}
```

**Key Features:**

- **Encryption**: Automatically encrypts/decrypts access tokens
- **Type Safety**: Uses Drizzle ORM inferred types
- **DATA_DOCTRINE**: Handles null/undefined conversion

---

## Client-Side Components

### 1. Auth Context (`client/src/contexts/AuthContext.tsx`)

**Purpose:** Manages authentication state across the React app.

```typescript
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: () => void;
  logout: () => void;
}
```

**Key Functions:**

- `login()`: Redirects to Google OAuth
- `logout()`: Handles secure logout with CSRF
- **State Management**: Uses React Query for user data fetching
- **Auto-refresh**: Automatically checks auth status

**Important Implementation Details:**

```typescript
// User data fetching
const { data, isLoading, error } = useQuery({
  queryKey: ['user'],
  queryFn: async () => {
    const response = await fetch('/auth/user');
    if (!response.ok) throw new Error('Not authenticated');
    return response.json();
  },
  retry: false,
  refetchOnWindowFocus: false,
});

// Secure logout with CSRF
const logout = async (): Promise<void> => {
  const csrfResponse = await fetch('/auth/csrf-token', { credentials: 'include' });
  const { csrfToken } = await csrfResponse.json();

  await fetch('/auth/logout', {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-CSRF-Token': csrfToken },
  });

  window.location.href = '/login';
};
```

### 2. Login Page (`client/src/pages/Login.tsx`)

**Purpose:** Login UI with Google OAuth integration.

**Key Features:**

- **Auto-redirect**: Redirects authenticated users to dashboard
- **Loading states**: Shows spinner during auth checks
- **Error handling**: Displays auth errors from URL params
- **Accessible UI**: Proper ARIA labels and semantic HTML

```typescript
const { user, isLoading, login } = useAuth();

// Auto-redirect if already authenticated
useEffect(() => {
  if (user && !isLoading) {
    setLocation('/');
  }
}, [user, isLoading, setLocation]);
```

---

## Authentication Flow

### 1. Initial Page Load

1. User visits app → AuthContext loads
2. React Query fetches /auth/user
3. If 401: user = null, show login page
4. If 200: user = userData, show dashboard

### 2. Google OAuth Login Flow

1. User clicks "Continue with Google"
   ↓
2. login() → window.location.href = "/auth/google"
   ↓
3. Passport redirects to Google OAuth
   ↓
4. Google shows consent screen (if needed)
   ↓
5. User authorizes → Google redirects to /auth/google/callback
   ↓
6. Passport verifies auth code with Google
   ↓
7. AuthService.findOrCreateGoogleUser() runs
   ↓
8. JWT token generated → Auth cookie set
   ↓
9. Redirect to dashboard ("/")
   ↓
10. AuthContext refetches user data
    ↓
11. User logged in successfully

### 3. Logout Flow

1. User clicks logout
   ↓
2. Fetch CSRF token from /auth/csrf-token
   ↓
3. POST /auth/logout with CSRF token
   ↓
4. Server clears auth cookie
   ↓
5. Redirect to /login
   ↓
6. AuthContext shows login page

---

## Troubleshooting Guide

### Symptom: Infinite Loop/Console Spam

**Possible Causes:**

1. useEffect without proper dependencies
2. React Query infinite refetching
3. State update loops

**Solution:**
Check for useEffect hooks that update their own dependencies:

```typescript
// ❌ Bad - causes infinite loop
useEffect(() => {
  setRecognition(new SpeechRecognition());
}, [recognition]);

// ✅ Good - runs once
useEffect(() => {
  setRecognition(new SpeechRecognition());
}, []);
```

### Symptom: "Authentication required" on /auth/user

**Possible Causes:**

1. JWT cookie not set
2. JWT secret mismatch
3. Cookie security settings
4. Rate limiting blocking requests

**Debugging Steps:**

```bash
# Check if cookie is set
curl -v http://localhost:8080/auth/user

# Check cookie in browser dev tools
# Application → Cookies → look for 'auth-token'

# Test JWT generation
console.log(generateToken('test-user-id'));
```

### Symptom: CSRF Token Errors

**Possible Causes:**

1. Missing CSRF token in requests
2. Session not properly configured
3. CSRF middleware misconfiguration

**Solution:**

```typescript
// Ensure proper CSRF token handling
const csrfResponse = await fetch("/auth/csrf-token", { credentials: "include" });
const { csrfToken } = await csrfResponse.json();

// Include in requests
headers: {
  "X-CSRF-Token": csrfToken,
}
```

---

## Security Considerations

### 1. Cookie Security

```typescript
// Secure cookie settings
res.cookie(COOKIE_NAME, token, {
  httpOnly: true, // Prevent XSS
  secure: process.env.NODE_ENV === 'production', // HTTPS only in prod
  sameSite: 'lax', // CSRF protection
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/', // Available site-wide
});
```

### 2. CSRF Protection

- **All state-changing requests** require CSRF tokens
- **GET requests** are exempt from CSRF
- **OAuth callbacks** are exempt (Google provides state verification)

### 3. Content Security Policy

```typescript
// Secure CSP headers
contentSecurityPolicy: {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],           // No unsafe-inline
    styleSrc: ["'self'", "'unsafe-inline'"], // CSS needs unsafe-inline
    imgSrc: ["'self'", 'data:', 'https:'],
    connectSrc: ["'self'"],
  }
}
```

### 4. Token Management

- **JWT tokens** have 7-day expiration
- **Refresh tokens** are encrypted in database
- **Access tokens** are encrypted in database
- **Session tokens** use secure session store

---

## Testing

### Manual Testing Checklist

```bash
# 1. Fresh user login
- Open incognito window
- Navigate to app
- Should see login page
- Click "Continue with Google"
- Should see Google consent screen
- Authorize → should reach dashboard

# 2. Returning user login
- Open normal browser (already signed into Google)
- Navigate to app
- Should see login page
- Click "Continue with Google"
- Should go directly to dashboard (no Google screen)

# 3. Logout functionality
- Click logout in app
- Should redirect to login page
- Should not be able to access protected routes

# 4. Protected routes
- Try accessing /dashboard without auth
- Should redirect to login

# 5. Session persistence
- Login → close browser → reopen
- Should still be logged in (within 7 days)
```

### API Testing

```bash
# Test auth endpoints
curl -v http://localhost:8080/auth/user
# Should return 401 without cookie

curl -v -b "auth-token=valid-jwt" http://localhost:8080/auth/user
# Should return user data with valid JWT

# Test CSRF endpoint
curl -v http://localhost:8080/auth/csrf-token
# Should return CSRF token
```

---

## Common Issues & Solutions

### Issue: "Invalid redirect URI"

**Cause:** Mismatch between `GOOGLE_CALLBACK_URL` and Google Console settings.

**Solution:**

1. Check `GOOGLE_CALLBACK_URL` in `.env`
2. Verify exact match in Google Cloud Console
3. Include protocol (`http://` or `https://`)
4. No trailing slashes

### Issue: "User not authenticated after OAuth"

**Cause:** User creation/lookup failing in `AuthService.findOrCreateGoogleUser()`.

**Debug:**

```typescript
// Add logging to auth.routes.ts callback
console.log('User object:', req.user);
console.log('Type guard result:', isAuthenticatedUser(req.user));
```

### Issue: JWT Secret Mismatch

**Symptoms:** "Invalid token" errors for valid users.

**Solution:**

1. Ensure `JWT_SECRET` is set and consistent
2. Check for secret rotation without user logout
3. Verify no special characters breaking environment parsing

---

## File Dependencies

### Critical Path Files

If any of these files are broken, authentication will fail:

1. **`server/utils/passport-config.ts`** - OAuth setup
2. **`server/services/auth.service.ts`** - Business logic
3. **`server/api/auth.routes.ts`** - HTTP endpoints
4. **`client/src/contexts/AuthContext.tsx`** - Client state
5. **`server/utils/jwt-auth.ts`** - Token management

### Environment Dependencies

```bash
# Required for OAuth
GOOGLE_OAUTH_CLIENT_ID
GOOGLE_OAUTH_CLIENT_SECRET

# Required for security
JWT_SECRET
SESSION_SECRET

# Required for database
DATABASE_URL
```

### Package Dependencies

```json
{
  "passport": "^0.6.0",
  "passport-google-oauth20": "^2.0.0",
  "jsonwebtoken": "^9.0.0",
  "express-session": "^1.17.0",
  "helmet": "^7.0.0"
}
```

---

## Support

For authentication issues:

1. **Check this guide** for common solutions
2. **Review server logs** for error details
3. **Test with curl** to isolate client vs server issues
4. **Check Google Console** for OAuth configuration
5. **Verify environment variables** are loaded correctly

---

**Document Version:** 1.0  
**Last Updated:** August 2025  
**Maintainer:** Development Team
