# TypeScript Error Fixes - Parallel Work Plan

## Overview

Total: **102 TypeScript errors** across **26 files**

This plan divides the work into **5 independent tracks** that can be worked on simultaneously without conflicts.

---

## 🎯 **TRACK 1: Authentication & Core Services**

**Developer A - High Priority**
**Files:** `server/services/auth.ts`, `server/services/openrouter.ts`
**Errors:** 10 total (4 + 6)

### auth.ts (4 errors)

- **Issue:** Passport.js type conflicts with User vs AppUser
- **Root Cause:** Type system conflicts between Passport and our schema types
- **Fix Strategy:**
  1. Use proper Passport strategy options (passReqToCallback)
  2. Fix serialize/deserialize user functions
  3. Proper error handling in callbacks
- **Files to touch:** `server/services/auth.ts` only

### openrouter.ts (6 errors)

- **Issue:** Null safety and unknown type handling
- **Root Cause:** CalendarEvent attendees field is `unknown`, missing null checks
- **Fix Strategy:**
  1. Add proper type guards for `event.attendees`
  2. Fix null safety for `event.summary`
  3. Add optional chaining for storage methods
- **Files to touch:** `server/services/openrouter.ts` only

---

## 🎯 **TRACK 2: Client-Side UI Components**

**Developer B - Medium Priority**
**Files:** All `client/src/components/*` and `client/src/pages/*`
**Errors:** 42 total

### UI Library Issues (18 errors)

- `client/src/components/ui/carousel.tsx` (14 errors)
- `client/src/components/ui/sidebar.tsx` (4 errors)
- **Issue:** shadcn/ui component type mismatches
- **Fix Strategy:** Update component props and refs to match latest types

### Hook Issues (25 errors)

- `client/src/hooks/use-toast.ts` (23 errors)
- `client/src/hooks/useVoiceInput.ts` (2 errors)
- **Issue:** Toast hook implementation and voice input types
- **Fix Strategy:** Fix reducer types and event handler types

### Component Type Issues (11 errors)

- Contact components (6 errors across multiple files)
- Dashboard components (4 errors)
- Layout components (2 errors)
- **Issue:** Missing props, incorrect API calls
- **Fix Strategy:** Fix prop types and API call signatures

### Page Components (14 errors)

- `client/src/pages/Tasks.tsx` (10 errors)
- `client/src/pages/Settings.tsx` (3 errors)
- `client/src/pages/Contacts.tsx` (6 errors)
- `client/src/pages/Login.tsx` (1 error)
- **Issue:** State management and API integration types
- **Fix Strategy:** Fix state types and API call patterns

---

## 🎯 **TRACK 3: API Routes & Data Layer**

**Developer C - High Priority**
**Files:** `server/routes.ts`, `server/storage.ts`, type definitions
**Errors:** 4 direct + related storage issues

### routes.ts (4 errors)

- **Issue:** CalendarEventAnalysis null handling in route responses
- **Root Cause:** Trying to pass null where Record<string, unknown> expected
- **Fix Strategy:**
  1. Add null checks before passing to response
  2. Use proper type guards
  3. Handle undefined analysis results
- **Files to touch:** `server/routes.ts`, potentially `server/types/llm-types.ts`

### Related Storage Interface Issues

- **Issue:** Storage interface method signatures don't match implementation
- **Root Cause:** ProcessedEvent type mismatch between interface and schema
- **Fix Strategy:** Already partially fixed, verify consistency

---

## 🎯 **TRACK 4: Test Files & Scripts**

**Developer D - Low Priority**
**Files:** Test files and utility scripts
**Errors:** 4 total

### Test Files (2 errors)

- `server/test-llm-integration.ts` (1 error)
- `server/test-single-llm.ts` (1 error)
- **Issue:** ContactData interface mismatches in test data
- **Fix Strategy:** Update mock data to match ContactData interface

### Scripts (2 errors)

- `scripts/seed-test-data.ts` (2 errors)
- **Issue:** Import and data structure issues
- **Fix Strategy:** Fix imports and data types

---

## 🎯 **TRACK 5: Client-Side Infrastructure**

**Developer E - Medium Priority**
**Files:** Client-side services and utilities
**Errors:** 7 total

### Query Client (6 errors)

- `client/src/lib/queryClient.ts` (6 errors)
- **Issue:** React Query configuration and error handling
- **Fix Strategy:** Fix query client setup and error types

### Services (1 error)

- `client/src/services/aiPhotoFinder.ts` (1 error)
- **Issue:** API response type handling
- **Fix Strategy:** Fix response type expectations

---

## 🔄 **Dependencies Between Tracks**

### Critical Path

1. **TRACK 3** (API Routes) should be completed first - affects other tracks
2. **TRACK 1** (Auth) is independent and can run parallel
3. **TRACK 2** (UI Components) depends on TRACK 3 for API types
4. **TRACK 4** (Tests) depends on TRACK 3 for data interfaces
5. **TRACK 5** (Client Infrastructure) can run mostly parallel

### Shared Files to Avoid Conflicts

- `server/types/llm-types.ts` - Only TRACK 1 & 3 should touch
- `shared/schema.ts` - Should not be modified (source of truth)
- `server/storage.ts` - Only TRACK 3 should touch

---

## 📋 **Work Assignments**

### Developer A (TRACK 1): Authentication & Core Services

```bash
# Files to work on:
- server/services/auth.ts
- server/services/openrouter.ts

# Commands to test:
npm run type-check:server
npm run dev  # Test auth flow
```

### Developer B (TRACK 2): Client-Side UI Components

```bash
# Files to work on:
- client/src/components/ui/*
- client/src/hooks/*
- client/src/components/*
- client/src/pages/*

# Commands to test:
npm run type-check
npm run build:client
```

### Developer C (TRACK 3): API Routes & Data Layer

```bash
# Files to work on:
- server/routes.ts
- server/types/llm-types.ts (if needed)

# Commands to test:
npm run type-check:server
npm run dev  # Test API endpoints
```

### Developer D (TRACK 4): Test Files & Scripts

```bash
# Files to work on:
- server/test-*.ts
- scripts/seed-test-data.ts

# Commands to test:
npm run type-check
npm run seed  # Test seed script
```

### Developer E (TRACK 5): Client-Side Infrastructure

```bash
# Files to work on:
- client/src/lib/queryClient.ts
- client/src/services/*

# Commands to test:
npm run type-check
npm run build:client
```

---

## 🎯 **Success Criteria**

### Individual Track Success

- All TypeScript errors in assigned files resolved
- `npm run type-check` passes for relevant parts
- No new errors introduced

### Overall Success

- Total error count: **102 → 0**
- `npm run type-check` passes completely
- `npm run build` succeeds
- All functionality preserved

---

## 📞 **Communication Protocol**

1. **Before starting:** Claim your track in team chat
2. **During work:** Update progress every 30 minutes
3. **Before committing:** Run type-check for your area
4. **Conflicts:** If you need to touch shared files, coordinate in chat
5. **Completion:** Report when your track is done

---

## 🚀 **Estimated Timeline**

- **TRACK 1:** 2-3 hours (complex Passport.js types)
- **TRACK 2:** 3-4 hours (many small fixes)
- **TRACK 3:** 1-2 hours (focused API fixes)
- **TRACK 4:** 1 hour (simple test fixes)
- **TRACK 5:** 1-2 hours (infrastructure fixes)

**Total parallel time:** 3-4 hours (vs 8+ hours sequential)
