import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { storage } from '../storage';
import type { User } from '@shared/schema';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.OAUTH_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || process.env.OAUTH_CLIENT_SECRET;
const CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || `${process.env.REPLIT_DOMAINS?.split(',')[0] || 'http://localhost:5000'}/auth/google/callback`;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.warn('Google OAuth credentials not configured. Authentication will not work.');
}

passport.use(new GoogleStrategy({
  clientID: GOOGLE_CLIENT_ID!,
  clientSecret: GOOGLE_CLIENT_SECRET!,
  callbackURL: CALLBACK_URL,
  scope: [
    'email',
    'profile',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/drive.readonly'
  ]
}, async (accessToken: string, refreshToken: string, profile: any, done: any) => {
  try {
    let user = await storage.getUserByGoogleId(profile.id);
    
    if (!user) {
      user = await storage.createUser({
        googleId: profile.id,
        email: profile.emails?.[0]?.value || '',
        name: profile.displayName || '',
        picture: profile.photos?.[0]?.value,
        accessToken,
        refreshToken: refreshToken || ''
      });
    } else {
      // Update tokens
      user = await storage.updateUser(user.id, {
        accessToken,
        refreshToken: refreshToken || user.refreshToken
      });
    }
    
    return done(null, user);
  } catch (error) {
    return done(error, null);
  }
}));

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await storage.getUser(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export default passport;
