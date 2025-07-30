# MindfulCRM

A mindful CRM application integrating Google services with AI assistance for wellness solopreneurs.

## Features

- **Google Integration**: Seamless integration with Google services (Gmail, Calendar, etc.)
- **AI Assistant**: OpenAI-powered AI assistance for customer relationship management
- **Modern UI**: Built with React, TypeScript, and Tailwind CSS
- **Authentication**: Secure Google OAuth authentication
- **Database**: PostgreSQL with Drizzle ORM
- **Real-time**: Modern web technologies for responsive user experience

## Tech Stack

### Frontend
- **React** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **shadcn/ui** for UI components
- **React Query** for data fetching

### Backend
- **Node.js** with Express
- **TypeScript** for type safety
- **PostgreSQL** database
- **Drizzle ORM** for database operations
- **Google APIs** for service integration
- **OpenAI API** for AI features

## Prerequisites

- Node.js (v18 or higher)
- PostgreSQL database
- Google Cloud Console project with OAuth credentials
- OpenAI API key

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/PBLIZZ/MindfulCRM.git
   cd MindfulCRM
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   
   Copy the example environment file and configure your variables:
   ```bash
   cp .env.example .env
   ```
   
   Fill in the required environment variables in `.env`:
   - `DATABASE_URL`: Your PostgreSQL connection string
   - `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET`: From Google Cloud Console
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `SESSION_SECRET`: A secure random string for session encryption

4. **Database Setup**
   
   Run database migrations:
   ```bash
   npm run db:migrate
   ```

5. **Start Development Server**
   ```bash
   npm run dev
   ```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Yes |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | Yes |
| `GOOGLE_CALLBACK_URL` | OAuth callback URL | Yes |
| `OPENAI_API_KEY` | OpenAI API key for AI features | Yes |
| `SESSION_SECRET` | Secret for session encryption | Yes |
| `PORT` | Server port (default: 5000) | No |
| `NODE_ENV` | Environment (development/production) | No |

## Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the following APIs:
   - Google+ API
   - Gmail API
   - Google Calendar API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - `http://localhost:5000/auth/google/callback` (development)
   - Your production callback URL

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run db:generate` - Generate database migrations
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Drizzle Studio

## Project Structure

```
MindfulCRM/
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── contexts/       # React contexts
│   │   └── lib/            # Utility libraries
├── server/                 # Backend Express application
│   ├── services/           # Business logic services
│   ├── routes.ts           # API routes
│   ├── db.ts              # Database configuration
│   └── index.ts           # Server entry point
├── shared/                 # Shared types and schemas
└── migrations/            # Database migrations
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Security

- Environment variables are properly secured and not committed to version control
- Google OAuth is used for secure authentication
- Session secrets are encrypted
- Database credentials are environment-based

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, please open an issue on GitHub or contact the maintainers.
