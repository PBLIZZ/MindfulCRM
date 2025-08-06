import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { authService } from '../services/auth.service.js';
import type { User } from '../../shared/schema.js';
import type { GoogleProfile } from '../types/external-apis.js';

type PassportDone = (error: Error | null, user?: User | false) => void;

const GOOGLE_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL ?? 'http://localhost:8080/auth/google/callback';

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.warn('Google OAuth credentials not configured. Authentication will not work.');
}

passport.use(
  'google',
  new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID!,
      clientSecret: GOOGLE_CLIENT_SECRET!,
      callbackURL: CALLBACK_URL,
      scope: ['profile', 'email'],
    },
    async (
      accessToken: string,
      refreshToken: string,
      profile: GoogleProfile,
      done: PassportDone
    ) => {
      try {
        const user = await authService.findOrCreateGoogleUser(profile, accessToken, refreshToken);
        return done(null, user);
      } catch (error) {
        return done(error instanceof Error ? error : new Error('Authentication failed'), false);
      }
    }
  )
);

passport.serializeUser((user: unknown, done: (err: Error | null, id?: string) => void) => {
  const appUser = user as User;
  done(null, appUser.id);
});

passport.deserializeUser(
  async (id: string, done: (err: Error | null, user?: User | false) => void) => {
    try {
      const user = await authService.findUserById(id);
      done(null, user ?? false);
    } catch (error) {
      done(error instanceof Error ? error : new Error('Deserialization failed'), false);
    }
  }
);

export default passport;
