# MindfulCRM - Wellness Solopreneur Data Hub

A comprehensive, AI-powered CRM platform designed specifically for wellness solopreneurs to manage client relationships through intelligent data insights. The system integrates seamlessly with Google services (Gmail, Calendar, Drive) via OAuth to transform raw client data into actionable relationship management tools.

## 🌟 Features

### Core CRM Functionality

- **Contact Management**: Comprehensive client profiles with lifecycle tracking, tags, and custom fields
- **Interaction Timeline**: Chronological view of all client touchpoints (emails, meetings, notes)
- **Task Management**: AI-assisted task creation and delegation with priority management
- **Calendar Integration**: Multi-calendar sync with Google Calendar, event processing, and scheduling
- **Goal Tracking**: Client progress monitoring with visual indicators and analytics

### AI-Powered Intelligence

- **AI Assistant**: OpenAI GPT-4o powered chat with voice input capability and context awareness
- **Sentiment Analysis**: Automated emotional intelligence tracking for client interactions
- **AI Insights**: Automated client engagement analysis and relationship recommendations
- **Photo Enrichment**: AI-powered profile picture suggestions from multiple sources
- **Smart Task Delegation**: AI-driven task creation based on client interactions and patterns

### Data Integration & Sync

- **Gmail Sync**: Automated email processing and client communication extraction
- **Google Calendar**: Multi-calendar event sync with metadata preservation
- **Google Drive**: Session notes and intake form processing (PDF/DOCX)
- **Real-time Sync**: Hourly background synchronization with robust error handling
- **Batch Processing**: Efficient bulk data processing with concurrency control

### Modern UI/UX

- **Responsive Design**: Mobile-first design with desktop optimization
- **Dark Mode**: Full dark mode support with custom teal theme
- **Voice Interface**: Web Speech API integration for hands-free interaction
- **Real-time Updates**: Live data updates with optimistic UI patterns
- **Professional Dashboard**: Analytics, quick actions, and activity feeds

## 🏗️ Architecture

### Frontend Stack

- **React 19** with TypeScript for type-safe component development
- **Vite** for lightning-fast development and optimized production builds
- **Tailwind CSS v4** with shadcn/ui component library for modern styling
- **TanStack React Query** for intelligent server state management and caching
- **Wouter** for lightweight client-side routing
- **Radix UI** primitives with custom theming for accessible components

### Backend Stack

- **Node.js** with Express.js framework and TypeScript ES modules
- **PostgreSQL** with Neon serverless database and connection pooling
- **Drizzle ORM** for type-safe database operations and schema management
- **Passport.js** with Google OAuth 2.0 for secure authentication
- **Express Sessions** with PostgreSQL session store for scalable session management

### AI & External Services

- **OpenAI GPT-4o** for chat, insights, and natural language processing
- **Multiple LLM Providers**: OpenRouter, Mistral, Gemini for specialized tasks
- **Google APIs**: Gmail, Calendar, Drive integration with proper scope management
- **Advanced Rate Limiting**: Intelligent request throttling and concurrency control
- **Cost Tracking**: LLM usage monitoring and budget management

### Data Processing Architecture

- **Brain-Based Processing**: Modular AI processing units for specific tasks
- **Service Contracts**: Standardized interfaces for all internal services
- **Data Doctrine**: Strict typing with database as single source of truth
- **Batch Processing**: Efficient bulk operations with error resilience
- **Background Jobs**: Scheduled tasks with cron-based automation

## 🚀 Quick Start

### Prerequisites

- **Node.js** v18 or higher
- **PostgreSQL** database (local or cloud)
- **Google Cloud Console** project with OAuth credentials
- **OpenAI API** key for AI features

### Installation

1. **Clone and Install**

   ```bash
   git clone https://github.com/PBLIZZ/MindfulCRM.git
   cd MindfulCRM
   npm install
   ```

2. **Environment Configuration**

   ```bash
   cp .env.example .env
   ```

   Configure your `.env` file with:

   ```env
   # Database
   DATABASE_URL=postgresql://username:password@localhost:5432/mindfulcrm

   # Google OAuth (required)
   GOOGLE_OAUTH_CLIENT_ID=your_client_id
   GOOGLE_OAUTH_CLIENT_SECRET=your_client_secret
   GOOGLE_CALLBACK_URL=http://localhost:8080/auth/google/callback

   # AI Services
   OPENAI_API_KEY=your_openai_key
   OPENROUTER_API_KEY=your_openrouter_key  # Optional
   MISTRAL_API_KEY=your_mistral_key        # Optional
   GOOGLE_API_KEY=your_google_ai_key       # Optional

   # Security
   SESSION_SECRET=your_secure_random_string
   JWT_SECRET=your_jwt_secret
   ENCRYPTION_KEY=your_32_char_encryption_key

   # Development
   PORT=8080
   DEV_BYPASS_AUTH=false
   ```

3. **Database Setup**

   ```bash
   npm run db:push    # Apply schema to database
   npm run seed       # Optional: Add test data
   ```

4. **Start Development**

   ```bash
   npm run dev        # Starts both client and server
   ```

### Google Cloud Setup

1. **Create Google Cloud Project**

   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create new project or select existing

2. **Enable Required APIs**

   - Google+ API (for authentication)
   - Gmail API (for email sync)
   - Google Calendar API (for calendar sync)
   - Google Drive API (for document processing)

3. **Create OAuth 2.0 Credentials**

   - Go to Credentials → Create Credentials → OAuth 2.0 Client ID
   - Application type: Web application
   - Authorized redirect URIs:
     - `http://localhost:8080/auth/google/callback` (development)
     - `https://yourdomain.com/auth/google/callback` (production)

4. **Configure Scopes**
   The application requests these OAuth scopes:
   - `profile email` - Basic profile information
   - `https://www.googleapis.com/auth/gmail.readonly` - Email access
   - `https://www.googleapis.com/auth/calendar` - Calendar read/write
   - `https://www.googleapis.com/auth/drive.readonly` - Document access

## 📁 Project Structure

MindfulCRM/
├── client/ # React frontend application
│ ├── src/
│ │ ├── components/ # Reusable UI components
│ │ │ ├── Contact/ # Contact management components
│ │ │ ├── Dashboard/ # Dashboard widgets
│ │ │ ├── Layout/ # Layout and navigation
│ │ │ └── ui/ # shadcn/ui components
│ │ ├── pages/ # Page components and routing
│ │ ├── hooks/ # Custom React hooks
│ │ ├── contexts/ # React contexts (Auth, Theme)
│ │ └── lib/ # Utility libraries and config
│ └── index.html # HTML entry point
├── server/ # Node.js backend application
│ ├── api/ # API route handlers (modular)
│ ├── brains/ # AI processing modules
│ ├── data/ # Data access layer
│ ├── providers/ # External service providers
│ ├── services/ # Business logic services
│ ├── schemas/ # Zod validation schemas
│ ├── types/ # TypeScript type definitions
│ ├── utils/ # Utility functions and helpers
│ └── index.ts # Server entry point
├── shared/ # Shared types and schemas
│ ├── schema.ts # Drizzle database schema
│ └── DATA_DOCTRINE.md # Architecture guidelines
├── uploads/ # File upload storage
├── temp/ # Temporary file processing
└── types/ # Global TypeScript definitions

## 🛠️ Development Scripts

```bash
# Development
npm run dev              # Start development server with hot reload
npm run type-check       # TypeScript compilation check

# Building
npm run build:client     # Build React frontend
npm run build:server     # Build Node.js backend
npm run build           # Build both client and server

# Production
npm start               # Start production server

# Database
npm run db:push         # Apply schema changes to database
npm run seed            # Seed database with test data

# Code Quality
npm run lint            # Run ESLint
npm run lint:fix        # Fix ESLint issues automatically

# Testing
npm run test:llm        # Test LLM integrations
```

## 🔧 Configuration

### Environment Variables

| Variable                     | Description                    | Required | Default |
| ---------------------------- | ------------------------------ | -------- | ------- |
| `DATABASE_URL`               | PostgreSQL connection string   | ✅       | -       |
| `GOOGLE_OAUTH_CLIENT_ID`     | Google OAuth client ID         | ✅       | -       |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Google OAuth client secret     | ✅       | -       |
| `GOOGLE_CALLBACK_URL`        | OAuth callback URL             | ✅       | -       |
| `OPENAI_API_KEY`             | OpenAI API key for AI features | ❌       | -       |
| `SESSION_SECRET`             | Session encryption secret      | ✅       | -       |
| `JWT_SECRET`                 | JWT token secret               | ✅       | -       |
| `ENCRYPTION_KEY`             | Data encryption key (32 chars) | ✅       | -       |
| `PORT`                       | Server port                    | ❌       | 8080    |
| `DEV_BYPASS_AUTH`            | Skip auth in development       | ❌       | false   |
| `OPENROUTER_API_KEY`         | OpenRouter API key             | ✅       | -       |
| `MISTRAL_API_KEY`            | Mistral AI API key             | ✅       | -       |
| `GEMINI_API_KEY`             | Gemini AI API key              | ✅       | -       |

### Database Schema

The application uses a comprehensive PostgreSQL schema with:

- **Users**: Google OAuth user profiles with token management
- **Contacts**: Client profiles with lifecycle stages and custom fields
- **Interactions**: Communication history and sentiment tracking
- **Tasks**: AI-assisted task management with priorities
- **Calendar Events**: Multi-calendar sync with metadata
- **Tags**: Flexible tagging system for organization
- **AI Suggestions**: Machine learning recommendations

## 🔒 Security Features

- **OAuth 2.0 Authentication**: Secure Google authentication with token refresh
- **CSRF Protection**: Cross-site request forgery prevention
- **Rate Limiting**: API endpoint protection with intelligent throttling
- **Input Validation**: Comprehensive Zod schema validation
- **Session Security**: Secure session management with PostgreSQL store
- **Data Encryption**: Sensitive data encryption at rest
- **GDPR Compliance**: Privacy controls and consent management

## 🚀 Deployment

### Production Build

```bash
npm run build           # Creates optimized production build
npm start              # Starts production server
```

### Environment Setup

- Set `NODE_ENV=production`
- Configure production database URL
- Set secure session secrets
- Configure production OAuth callbacks
- Enable SSL/HTTPS in production

### Recommended Hosting

- **Backend**: Railway, Render, or DigitalOcean App Platform
- **Database**: Neon, Supabase, or managed PostgreSQL
- **Frontend**: Served by Express.js backend (full-stack deployment)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Follow the coding standards and architecture guidelines
4. Add tests for new functionality
5. Commit changes (`git commit -m 'feat: add amazing feature'`)
6. Push to branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Code Standards

- **TypeScript**: Strict typing throughout
- **ESLint**: Automated code quality checks
- **Prettier**: Consistent code formatting
- **Conventional Commits**: Standardized commit messages
- **Data Doctrine**: Follow established architecture patterns

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Issues**: Report bugs and feature requests on [GitHub Issues](https://github.com/PBLIZZ/MindfulCRM/issues)
- **Documentation**: Check the `/server/types/` directory for architecture guidelines
- **Community**: Join discussions in GitHub Discussions

## 🙏 Acknowledgments

- **shadcn/ui** for the beautiful component library
- **Drizzle ORM** for type-safe database operations
- **TanStack Query** for intelligent data fetching
- **OpenRouter** for powerful AI agnostic capabilities
- **Google APIs** for seamless service integration

---

**Built with ❤️ for wellness solopreneurs who want to focus on helping clients, not managing data.**
