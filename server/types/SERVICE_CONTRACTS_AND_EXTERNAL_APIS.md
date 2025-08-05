# Service Contracts and External APIs Architecture

## Overview

This document outlines the architectural decision to separate and organize TypeScript type definitions into two distinct categories: **Service Contracts** and **External APIs**. This separation provides clear boundaries between internal service interfaces and third-party API integrations, improving code maintainability, type safety, and developer experience.

## Table of Contents

- [Architecture Rationale](#architecture-rationale)
- [File Structure](#file-structure)
- [Service Contracts](#service-contracts)
- [External APIs](#external-apis)
- [Migration Process](#migration-process)
- [Developer Guidelines](#developer-guidelines)
- [Best Practices](#best-practices)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)

## Architecture Rationale

### Problems Solved

**Before the refactoring:**

- Type definitions scattered across multiple files
- Mixing of internal service contracts with external API types
- Duplicate type definitions in different locations
- Unclear boundaries between internal and external data structures
- Difficult to maintain consistency across service implementations
- Hard to understand service dependencies and contracts

**After the refactoring:**

- ✅ **Clear Separation**: Internal contracts vs external API types
- ✅ **Single Source of Truth**: Centralized type definitions
- ✅ **Better Organization**: Logical grouping by purpose
- ✅ **Improved Maintainability**: Easier to update and extend
- ✅ **Enhanced Documentation**: Comprehensive JSDoc comments
- ✅ **Type Safety**: Consistent interfaces across services

### Design Principles

1. **Separation of Concerns**: Internal service contracts are separate from external API types
2. **Single Responsibility**: Each file has a specific purpose and scope
3. **Dependency Injection**: Well-defined interfaces for service dependencies
4. **Documentation First**: Every interface includes comprehensive documentation
5. **Future-Proof**: Easy to extend and modify without breaking changes

## File Structure

server/types/
├── service-contracts.ts # Internal service interface definitions
├── external-apis.ts # Third-party API type definitions
└── llm-types.archive.ts # Legacy types (being phased out)

### File Purposes

| File                   | Purpose                                   | Contains                                                     |
| ---------------------- | ----------------------------------------- | ------------------------------------------------------------ |
| `service-contracts.ts` | Internal service interfaces and contracts | Storage interfaces, LLM processors, service configs, metrics |
| `external-apis.ts`     | Third-party API types and DTOs            | Google APIs, Clearbit, photo services, contact DTOs          |
| `llm-types.archive.ts` | Legacy types (deprecated)                 | Calendar event analysis, remaining legacy types              |

## Service Contracts

**Location**: `server/types/service-contracts.ts`

### What Goes Here

Service contracts define the **internal interfaces** that our services must implement. These are contracts between different parts of our application.

#### Categories of Service Contracts

1. **Storage Service Contracts**

   - `StorageInterface` - Data persistence operations
   - Database abstraction layers
   - Repository patterns

2. **LLM Service Contracts**

   - `LLMProcessor` - Language model operations
   - `LLMServiceConfig` - Service configuration
   - `ProcessingContext` - Operation context

3. **Task & Project Service Contracts**

   - `TaskStrategy` - AI-driven task management
   - `ContactSegment` - Targeted operations
   - `BulkAction` - Batch operations

4. **Monitoring & Analytics Contracts**

   - `ProcessingMetrics` - Service monitoring
   - `ConcurrencyStats` - Performance statistics
   - `ErrorContext` - Debugging context

5. **Data Processing Contracts**
   - `InteractionData` - Service communication
   - `EmailFilterConfig` - Processing configuration

### Example Service Contract

```typescript
/**
 * Storage interface for dependency injection
 * Defines the contract for data persistence operations
 */
export interface StorageInterface {
  getProcessedEvents?(): Promise<ProcessedEvent[]>;
  saveProcessedEvent?(event: ProcessedEvent): Promise<void>;
  getContacts?(userId: string): Promise<ContactData[]>;
  shouldProcessEvent?(eventId: string): Promise<boolean>;
  markEventProcessed(
    eventId: string,
    eventHash: string,
    isRelevant: boolean,
    analysis?: CalendarEventAnalysis,
    llmModel?: string
  ): Promise<ProcessedEvent>;
}
```

## External APIs

**Location**: `server/types/external-apis.ts`

### What Should Go Here

External API types define the **shape of data from third-party services** and **data transfer objects (DTOs)** used for API communication.

#### Categories of External API Types

1. **Google API Types**

   - `GoogleAuthProfile` - OAuth profile structure
   - `GoogleProfile` - Profile interface
   - `UserAuthData` - Authentication data

2. **Third-Party Service APIs**

   - `ClearbitPersonResponse` - Clearbit API responses
   - `PhotoSuggestion` - Photo service responses
   - `AIPhotoFinderResult` - AI service results

3. **Data Transfer Objects (DTOs)**

   - `ContactData` - Sanitized contact data for API/LLM
   - `ContactInfo` - External service contact format
   - `AttendeeData` - Calendar attendee information

4. **Generic API Types**
   - `ErrorResponse` - Standard error format
   - `UnknownObject` - Generic object type
   - `PhotoDownloadResponse` - File download responses

### Example External API Type

```typescript
/**
 * Clearbit Person API response structure
 */
export interface ClearbitPersonResponse {
  avatar?: string;
  name?: {
    fullName?: string;
    givenName?: string;
    familyName?: string;
  };
  employment?: {
    name?: string;
    title?: string;
    domain?: string;
  };
  [key: string]: unknown;
}
```

## Migration Process

### Step-by-Step Migration

When we consolidated the types, we followed this systematic process:

1. **Identify Type Categories**

   - Analyze existing type definitions
   - Categorize as internal contracts vs external APIs
   - Document dependencies between types

2. **Create Centralized Files**

   - Create `service-contracts.ts` for internal interfaces
   - Create `external-apis.ts` for third-party types
   - Add comprehensive documentation

3. **Move Type Definitions**

   - Move service interfaces to `service-contracts.ts`
   - Move external API types to `external-apis.ts`
   - Update import statements across codebase

4. **Clean Up Legacy Files**

   - Remove duplicate definitions from old files
   - Add migration comments for clarity
   - Update all import references

5. **Verify and Test**
   - Run TypeScript compilation checks
   - Ensure all imports resolve correctly
   - Verify no breaking changes

### Files Updated During Migration

- ✅ `server/services/openrouter.archive.ts`
- ✅ `server/services/llm-enhanced.service.ts`
- ✅ `server/services/openai.archive.ts`
- ✅ `server/services/gemini.archive.ts`
- ✅ `server/providers/openrouter.provider.ts`
- ✅ `server/utils/gmail-filter.ts`
- ✅ `client/src/services/aiPhotoFinder.ts`
- ✅ `docs/tests/test-single-llm.ts`
- ✅ `docs/tests/test-llm-integration.ts`

## Developer Guidelines

### When to Use Service Contracts

Use `service-contracts.ts` when defining:

- ✅ **Internal service interfaces** that other services depend on
- ✅ **Dependency injection contracts** for loose coupling
- ✅ **Service configuration interfaces** for consistent setup
- ✅ **Processing result interfaces** for internal operations
- ✅ **Monitoring and metrics interfaces** for observability

### When to Use External APIs

Use `external-apis.ts` when defining:

- ✅ **Third-party API response structures** (Google, Clearbit, etc.)
- ✅ **Data transfer objects (DTOs)** for API communication
- ✅ **Authentication profile structures** from OAuth providers
- ✅ **External service request/response formats**
- ✅ **Sanitized data structures** for LLM processing

### Import Guidelines

```typescript
// ✅ Good: Import service contracts for internal interfaces
import type { StorageInterface, LLMProcessor } from '../types/service-contracts.js';

// ✅ Good: Import external APIs for third-party types
import type { GoogleAuthProfile, ContactData } from '../types/external-apis.js';

// ❌ Bad: Don't mix internal and external in same import
import type { StorageInterface, GoogleAuthProfile } from '../types/mixed-file.js';
```

### Adding New Types

#### For Internal Service Contracts

1. **Determine the category** (Storage, LLM, Task, Monitoring, etc.)
2. **Add to appropriate section** in `service-contracts.ts`
3. **Include comprehensive JSDoc** documentation
4. **Follow naming conventions** (`Interface`, `Config`, `Context`, etc.)
5. **Update imports** in consuming files

```typescript
/**
 * New service contract for email processing
 */
export interface EmailProcessorInterface {
  processEmails(userId: string): Promise<ProcessedEmail[]>;
  filterSpam(emails: Email[]): Promise<Email[]>;
  extractInsights(emails: Email[]): Promise<EmailInsights>;
}
```

#### For External API Types

1. **Identify the third-party service** or DTO purpose
2. **Add to appropriate section** in `external-apis.ts`
3. **Include source documentation** (API docs, service name)
4. **Use descriptive names** that indicate the source
5. **Handle optional/nullable fields** appropriately

```typescript
/**
 * Slack API user profile response structure
 * @see https://api.slack.com/types/user
 */
export interface SlackUserProfile {
  id: string;
  name: string;
  real_name?: string;
  email?: string;
  image_72?: string;
  [key: string]: unknown;
}
```

## Best Practices

### Documentation Standards

1. **Every interface must have JSDoc** comments explaining its purpose
2. **Include @see references** for external API documentation
3. **Document complex properties** with inline comments
4. **Explain the rationale** for DTOs and data transformations

### Naming Conventions

#### The Service Contracts

- `Interface` suffix for service contracts (`StorageInterface`)
- `Config` suffix for configuration objects (`LLMServiceConfig`)
- `Context` suffix for operation context (`ProcessingContext`)
- `Metrics` suffix for monitoring data (`ProcessingMetrics`)

#### The External APIs

- Service name prefix for API responses (`ClearbitPersonResponse`)
- `Data` suffix for DTOs (`ContactData`, `UserAuthData`)
- Descriptive names for specific purposes (`PhotoSuggestion`)

### Type Safety Guidelines

1. **Use strict typing** - avoid `any` types
2. **Handle nullable fields** appropriately (`string | null`)
3. **Use generic types** for reusable interfaces (`AnalysisResult<T>`)
4. **Include index signatures** for extensible objects (`[key: string]: unknown`)

### Dependency Management

1. **Minimize cross-dependencies** between contract files
2. **Use import types** for type-only imports
3. **Avoid circular dependencies** between service contracts
4. **Keep external API types independent** of internal contracts

## Examples

### Complete Service Contract Example

```typescript
// server/types/service-contracts.ts

/**
 * Email processing service contract
 * Defines the interface for email analysis and processing operations
 */
export interface EmailProcessorInterface {
  /**
   * Process emails for a specific user
   * @param userId - The user ID to process emails for
   * @param config - Optional processing configuration
   * @returns Promise resolving to processed email results
   */
  processEmails(userId: string, config?: EmailProcessingConfig): Promise<ProcessedEmail[]>;

  /**
   * Filter spam emails from a collection
   * @param emails - Array of emails to filter
   * @returns Promise resolving to non-spam emails
   */
  filterSpam(emails: Email[]): Promise<Email[]>;
}

/**
 * Configuration for email processing operations
 */
export interface EmailProcessingConfig {
  maxEmails: number;
  daysBack: number;
  includeSpam: boolean;
  analysisDepth: 'basic' | 'detailed' | 'comprehensive';
}
```

### Complete External API Example

```typescript
// server/types/external-apis.ts

/**
 * Microsoft Graph API user profile response
 * @see https://docs.microsoft.com/en-us/graph/api/user-get
 */
export interface MicrosoftGraphUserProfile {
  id: string;
  displayName: string;
  mail?: string;
  userPrincipalName: string;
  jobTitle?: string;
  department?: string;
  officeLocation?: string;
  [key: string]: unknown;
}

/**
 * User data transfer object for internal processing
 * Sanitized version of external user profiles for consistent internal use
 */
export interface UserProfileData {
  id: string;
  name: string;
  email: string | null;
  jobTitle: string | null;
  department: string | null;
  source: 'google' | 'microsoft' | 'manual';
  createdAt: Date;
  updatedAt: Date;
}
```

### Usage in Services

```typescript
// server/services/email-processor.service.ts

import type { EmailProcessorInterface, EmailProcessingConfig } from '../types/service-contracts.js';

import type { MicrosoftGraphUserProfile, UserProfileData } from '../types/external-apis.js';

export class EmailProcessorService implements EmailProcessorInterface {
  async processEmails(userId: string, config?: EmailProcessingConfig): Promise<ProcessedEmail[]> {
    // Implementation using the contract
  }

  async filterSpam(emails: Email[]): Promise<Email[]> {
    // Implementation using the contract
  }

  private transformUserProfile(profile: MicrosoftGraphUserProfile): UserProfileData {
    // Transform external API data to internal DTO
    return {
      id: profile.id,
      name: profile.displayName,
      email: profile.mail || null,
      jobTitle: profile.jobTitle || null,
      department: profile.department || null,
      source: 'microsoft',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}
```

## Troubleshooting

### Common Issues and Solutions

#### Import Resolution Errors

**Problem**: `Cannot find module '../types/service-contracts.js'`

**Solution**:

1. Check file path is correct
2. Ensure `.js` extension in import (required for ES modules)
3. Verify TypeScript compilation target supports ES modules

```typescript
// ✅ Correct
import type { StorageInterface } from '../types/service-contracts.js';

// ❌ Incorrect
import type { StorageInterface } from '../types/service-contracts';
```

#### Circular Dependency Issues

**Problem**: Circular dependencies between service contracts

**Solution**:

1. Extract common types to separate file
2. Use forward declarations where possible
3. Restructure interfaces to remove circular references

#### Type Compatibility Issues

**Problem**: External API types don't match internal service contracts

**Solution**:

1. Create adapter functions to transform external data
2. Use DTOs to bridge the gap between external and internal types
3. Document transformation logic clearly

```typescript
// Transform external API data to internal contract
function transformToContactData(externalContact: ClearbitPersonResponse): ContactData {
  return {
    id: generateId(),
    name: externalContact.name?.fullName || 'Unknown',
    email: externalContact.email || '',
    // ... other transformations
  };
}
```

### Migration Checklist

When adding new types, use this checklist:

- [ ] **Categorized correctly** (service contract vs external API)
- [ ] **Comprehensive documentation** with JSDoc comments
- [ ] **Consistent naming** following established conventions
- [ ] **Proper imports** updated in all consuming files
- [ ] **TypeScript compilation** passes without errors
- [ ] **No circular dependencies** introduced
- [ ] **Tests updated** if applicable
- [ ] **Documentation updated** if needed

## Future Considerations

### Planned Improvements

1. **Auto-generation**: Generate service contracts from OpenAPI specs
2. **Validation**: Runtime validation for external API responses
3. **Versioning**: Version management for breaking changes
4. **Testing**: Automated testing for contract compliance
5. **Documentation**: Auto-generated documentation from types

### Extension Points

The current architecture supports easy extension:

- **New service categories** can be added to `service-contracts.ts`
- **New external APIs** can be added to `external-apis.ts`
- **Legacy types** can be gradually migrated from archive files
- **Validation schemas** can be generated from type definitions

---

## Conclusion

The separation of service contracts and external APIs provides a solid foundation for maintainable, type-safe code. This architecture makes it clear what interfaces our services must implement and how we interact with external systems.

**Key Benefits Achieved:**

- ✅ **Clear boundaries** between internal and external types
- ✅ **Single source of truth** for all type definitions
- ✅ **Better developer experience** with comprehensive documentation
- ✅ **Improved maintainability** through logical organization
- ✅ **Enhanced type safety** across the entire application

For questions or suggestions about this architecture, please refer to the development team or create an issue in the project repository.

---

**Last Updated**: August 2025  
**Version**: 1.0  
**Authors**: Development Team
