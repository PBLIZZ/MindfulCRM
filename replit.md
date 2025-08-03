# Wellness Solopreneur Data Hub

## Overview

This is a full-stack TypeScript application designed as a centralized platform for wellness solopreneurs to manage client relationships through AI-powered insights. The system integrates with Google services (Gmail, Calendar, Drive) via OAuth to transform raw data into actionable client management tools.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

- **Framework**: React 18 with TypeScript and Vite for development
- **Styling**: Tailwind CSS with shadcn/ui component library
- **State Management**: TanStack React Query for server state, React Context for local state
- **Routing**: Wouter for client-side routing
- **UI Components**: Radix UI primitives with custom styling via shadcn/ui
- **Theme System**: Custom teal-based theme with dark mode support

### Backend Architecture

- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Authentication**: Passport.js with Google OAuth 2.0 strategy
- **Session Management**: Express sessions with in-memory store
- **API Design**: RESTful endpoints with structured error handling

### Data Storage Solutions

- **Database**: PostgreSQL with Neon serverless database
- **ORM**: Drizzle ORM for type-safe database operations
- **Schema Management**: Drizzle Kit for migrations and schema management
- **Connection Pool**: Neon serverless connection pooling with WebSocket support

## Key Components

### Authentication System

- Google OAuth 2.0 integration with required scopes:
  - Email and profile access
  - Gmail readonly access
  - Calendar read/write access
  - Google Drive readonly access
- Session-based authentication with secure cookie handling
- Automatic token refresh handling

### Data Ingestion Pipeline

- **Gmail Sync**: Extracts recent emails and client communications
- **Calendar Sync**: Imports appointments and scheduled events
- **Drive Sync**: Processes session notes and intake forms (PDF/DOCX)
- **Scheduled Processing**: Hourly background sync via cron jobs
- **Error Handling**: Robust error management with sync status tracking

### AI Assistant

- **OpenAI Integration**: GPT-4o model for intelligent responses
- **Voice Input**: Web Speech API for voice-to-text functionality
- **Context Awareness**: Client data integration for personalized insights
- **Sentiment Analysis**: AI-powered sentiment scoring for interactions

### Client Management

- **Contact Dashboard**: Centralized view of client information
- **Interaction Timeline**: Chronological view of all client touchpoints
- **Goal Tracking**: Progress monitoring with visual indicators
- **AI Insights**: Automated sentiment analysis and engagement trends

## Data Flow

1. **Authentication Flow**: User authenticates via Google OAuth → tokens stored securely → user session established
2. **Data Sync Flow**: Background service → Google APIs → data extraction → database storage → AI processing
3. **User Interaction Flow**: Dashboard queries → API endpoints → database retrieval → AI enhancement → UI display
4. **Real-time Updates**: TanStack Query handles cache invalidation and background refetching

## External Dependencies

### Google Services Integration

- **Gmail API**: For email data extraction and analysis
- **Google Calendar API**: For appointment and scheduling data
- **Google Drive API**: For document processing and storage
- **OAuth 2.0**: For secure authentication and authorization

### AI Services

- **OpenAI API**: For natural language processing and chat functionality
- **Sentiment Analysis**: For emotional intelligence in client interactions

### Development Tools

- **Vite**: For fast development builds and hot reload
- **Replit Integration**: Special handling for Replit development environment
- **PostCSS/Autoprefixer**: For CSS processing and browser compatibility

## Deployment Strategy

### Build Process

- **Frontend**: Vite builds optimized React bundle to `dist/public`
- **Backend**: esbuild compiles TypeScript server to `dist/index.js`
- **Database**: Drizzle migrations applied via `db:push` command

### Environment Configuration

- **Development**: Local development with Vite dev server proxy
- **Production**: Express serves static files with API routes
- **Database**: Environment-based PostgreSQL connection strings
- **Secrets**: OAuth credentials and API keys via environment variables

### Performance Considerations

- **Caching Strategy**: TanStack Query provides intelligent client-side caching
- **Database Optimization**: Drizzle ORM with optimized queries and connection pooling
- **Static Assets**: Vite optimization for CSS and JavaScript bundles
- **API Rate Limiting**: Consideration for Google API quota limits

The architecture prioritizes type safety, developer experience, and scalable data processing while maintaining a clean separation between frontend presentation, backend business logic, and external service integrations.
