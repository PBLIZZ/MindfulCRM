import { storage } from '../data/index.js';
import { type User, type InsertUser } from '../../shared/schema.js';
import type { GoogleProfile } from '../types/external-apis.js';

export class AuthService {
  async getUserProfile(userId: string): Promise<User | undefined> {
    return storage.users.findById(userId);
  }

  async updateGdprConsent(
    userId: string,
    consent: {
      allowProfilePictureScraping: boolean;
      gdprConsentDate: Date;
      gdprConsentVersion: string;
    }
  ): Promise<User> {
    return storage.users.updateGdprConsent(userId, consent);
  }

  async findOrCreateGoogleUser(
    profile: GoogleProfile,
    accessToken: string,
    refreshToken: string
  ): Promise<User> {
    let user = await storage.users.findByGoogleId(profile.id);

    if (!user) {
      const email = profile.emails?.[0]?.value ?? '';
      const name = profile.displayName ?? '';
      const picture = profile.photos?.[0]?.value ?? null;

      const insertUser: InsertUser = {
        googleId: profile.id,
        email,
        name,
        picture,
        accessToken,
        refreshToken: refreshToken ?? '',
      };

      user = await storage.users.create(insertUser);
    } else {
      user = await storage.users.update(user.id, {
        accessToken,
        refreshToken: refreshToken ?? user.refreshToken,
      });
    }

    return user;
  }

  async findUserById(userId: string): Promise<User | undefined> {
    return storage.users.findById(userId);
  }
}

export const authService = new AuthService();
