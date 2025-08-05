import { db } from '../db.js';
import { users, type User, type InsertUser } from '../../shared/schema.js';
import { eq, gte } from 'drizzle-orm';
import { encrypt, decrypt } from '../utils/encryption.js';

export class UserData {
  private decryptUserTokens(user: User): User {
    try {
      return {
        ...user,
        accessToken: user.accessToken ? decrypt(user.accessToken) : '',
        refreshToken: user.refreshToken ? decrypt(user.refreshToken) : '',
      };
    } catch (error) {
      console.error('Decryption error for user:', user.id, error);
      // Return user with empty tokens if decryption fails
      return {
        ...user,
        accessToken: '',
        refreshToken: '',
      };
    }
  }

  async findById(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    if (!user) return undefined;
    return this.decryptUserTokens(user);
  }

  async findByGoogleId(googleId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.googleId, googleId));
    if (!user) return undefined;
    return this.decryptUserTokens(user);
  }

  async create(insertUser: InsertUser): Promise<User> {
    const encryptedUser = {
      ...insertUser,
      accessToken: insertUser.accessToken ? encrypt(insertUser.accessToken) : '',
      refreshToken: insertUser.refreshToken ? encrypt(insertUser.refreshToken) : '',
    };

    const [user] = await db.insert(users).values(encryptedUser).returning();
    return this.decryptUserTokens(user);
  }

  async update(id: string, updates: Partial<InsertUser>): Promise<User> {
    const encryptedUpdates = { ...updates };
    if (updates.accessToken && updates.accessToken.trim() !== '') {
      encryptedUpdates.accessToken = encrypt(updates.accessToken);
    }
    if (updates.refreshToken && updates.refreshToken.trim() !== '') {
      encryptedUpdates.refreshToken = encrypt(updates.refreshToken);
    }

    const [user] = await db
      .update(users)
      .set({ ...encryptedUpdates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();

    return this.decryptUserTokens(user);
  }

  async updateGdprConsent(
    id: string,
    consent: {
      allowProfilePictureScraping: boolean;
      gdprConsentDate: Date;
      gdprConsentVersion: string;
    }
  ): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        allowProfilePictureScraping: consent.allowProfilePictureScraping,
        gdprConsentDate: consent.gdprConsentDate,
        gdprConsentVersion: consent.gdprConsentVersion,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async delete(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getActiveUsers(
    daysSinceLastActivity: number
  ): Promise<Array<{ id: string; email: string }>> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysSinceLastActivity);

    return db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(gte(users.updatedAt, cutoffDate));
  }

  async getAll(): Promise<User[]> {
    const allUsers = await db.select().from(users);
    return allUsers.map((user) => this.decryptUserTokens(user));
  }
}
