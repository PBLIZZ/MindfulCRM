import cron from 'node-cron';
import { storage } from '../storage';
import { googleService } from './google';

export class SyncService {
  private isRunning = false;

  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    console.log('Starting sync service...');

    // Run sync every hour
    cron.schedule('0 * * * *', async () => {
      await this.performSync();
    });

    // Initial sync after 1 minute
    setTimeout(() => {
      this.performSync();
    }, 60000);
  }

  stop(): void {
    this.isRunning = false;
    console.log('Sync service stopped');
  }

  async performSync(): Promise<void> {
    console.log('Starting scheduled sync...');

    try {
      // Get all users that need syncing
      const allUsers = await this.getAllUsers();

      for (const user of allUsers) {
        try {
          console.log(`Syncing data for user: ${user.email}`);

          await Promise.all([
            googleService.syncGmail(user),
            googleService.syncCalendar(user),
            googleService.syncDrive(user),
          ]);

          console.log(`Sync completed for user: ${user.email}`);
        } catch (error) {
          console.error(`Sync failed for user ${user.email}:`, error);
        }
      }
    } catch (error) {
      console.error('Sync service error:', error);
    }
  }

  async manualSync(userId: string): Promise<void> {
    try {
      const user = await storage.getUser(userId);
      if (!user) {
        throw new Error('User not found');
      }

      await Promise.all([
        googleService.syncGmail(user),
        googleService.syncCalendar(user),
        googleService.syncDrive(user),
      ]);
    } catch (error) {
      console.error('Manual sync error:', error);
      throw error;
    }
  }
  async syncCalendar(userId: string): Promise<void> {
    try {
      const user = await storage.getUser(userId);
      if (!user) {
        throw new Error('User not found');
      }

      await googleService.syncCalendar(user);
    } catch (error) {
      console.error('Calendar sync error:', error);
      throw error;
    }
  }

  async syncEmails(userId: string): Promise<void> {
    try {
      const user = await storage.getUser(userId);
      if (!user) {
        throw new Error('User not found');
      }

      await googleService.syncGmail(user);
    } catch (error) {
      console.error('Email sync error:', error);
      throw error;
    }
  }

  private async getAllUsers(): Promise<any[]> {
    try {
      // Get all users from the database
      // Since we don't have a getAllUsers method in storage, we'll need to add it
      // For now, let's implement it here directly
      const { db } = await import('../db');
      const { users } = await import('@shared/schema');
      const allUsers = await db.select().from(users);
      return allUsers;
    } catch (error) {
      console.error('Error getting all users:', error);
      return [];
    }
  }
}

export const syncService = new SyncService();
