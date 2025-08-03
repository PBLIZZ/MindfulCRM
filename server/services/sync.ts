import cron from 'node-cron';
import { storage } from '../storage.js';
import { googleService } from './google.js';
import type { User } from '../../shared/schema.js';

export class SyncService {
  private isRunning = false;
  private syncJob: cron.ScheduledTask | null = null;

  start(): void {
    if (this.isRunning) {
      console.log('Sync service is already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting sync service...');

    // Run sync at 8am, 4pm, and midnight
    this.syncJob = cron.schedule('0 8,16,0 * * *', async () => {
      await this.performSync();
    });

    // Initial sync after 1 minute - DISABLED for dev, uncomment for production
    // setTimeout(() => {
    //   void this.performSync();
    // }, 60000);
  }

  stop(): void {
    if (this.syncJob) {
      // Explicitly ignore the promise return value from stop()
      void this.syncJob.stop();
      this.syncJob = null;
    }
    this.isRunning = false;
    console.log('Sync service stopped');
  }

  async performSync(): Promise<void> {
    if (!this.isRunning) {
      console.log('Sync service is not running, skipping sync');
      return;
    }

    console.log('Starting scheduled sync...');
    const startTime = Date.now();

    try {
      // Get all users that need syncing
      const allUsers = await this.getAllUsers();
      console.log(`Found ${allUsers.length} users to sync`);

      if (allUsers.length === 0) {
        console.log('No users found, skipping sync');
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      for (const user of allUsers) {
        try {
          if (!user.accessToken || !user.refreshToken) {
            console.warn(`User ${user.email} missing required tokens, skipping`);
            continue;
          }

          console.log(`Syncing data for user: ${user.email}`);

          await Promise.all([
            googleService.syncGmail(user),
            googleService.syncCalendar(user, { syncType: 'incremental' }),
            googleService.syncDrive(user),
          ]);

          console.log(`Sync completed for user: ${user.email}`);
          successCount++;
        } catch (error) {
          console.error(`Sync failed for user ${user.email}:`, error);
          errorCount++;
        }
      }

      const duration = Date.now() - startTime;
      console.log(`Sync completed: ${successCount} successful, ${errorCount} failed (${duration}ms)`);
    } catch (error) {
      console.error('Sync service error:', error);
      throw error;
    }
  }

  async manualSync(userId: string): Promise<void> {
    if (!userId || typeof userId !== 'string') {
      throw new Error('Valid user ID is required');
    }

    try {
      const user = await storage.getUser(userId);
      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      if (!user.accessToken || !user.refreshToken) {
        throw new Error(`User ${user.email} missing required authentication tokens`);
      }

      console.log(`Starting manual sync for user: ${user.email}`);
      const startTime = Date.now();

      await Promise.all([
        googleService.syncGmail(user),
        googleService.syncCalendar(user, { syncType: 'incremental' }),
        googleService.syncDrive(user),
      ]);

      const duration = Date.now() - startTime;
      console.log(`Manual sync completed for user ${user.email} (${duration}ms)`);
    } catch (error) {
      console.error('Manual sync error:', error);
      throw error;
    }
  }
  async syncCalendar(userId: string): Promise<void> {
    if (!userId || typeof userId !== 'string') {
      throw new Error('Valid user ID is required');
    }

    try {
      const user = await storage.getUser(userId);
      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      if (!user.accessToken || !user.refreshToken) {
        throw new Error(`User ${user.email} missing required authentication tokens`);
      }

      console.log(`Syncing calendar for user: ${user.email}`);
      const startTime = Date.now();

      // Use incremental sync for regular scheduled syncs
      await googleService.syncCalendar(user, {
        syncType: 'incremental'
      });

      const duration = Date.now() - startTime;
      console.log(`Calendar sync completed for user ${user.email} (${duration}ms)`);
    } catch (error) {
      console.error('Calendar sync error:', error);
      throw error;
    }
  }

  async syncEmails(userId: string): Promise<void> {
    if (!userId || typeof userId !== 'string') {
      throw new Error('Valid user ID is required');
    }

    try {
      const user = await storage.getUser(userId);
      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      if (!user.accessToken || !user.refreshToken) {
        throw new Error(`User ${user.email} missing required authentication tokens`);
      }

      console.log(`Syncing emails for user: ${user.email}`);
      const startTime = Date.now();

      await googleService.syncGmail(user);

      const duration = Date.now() - startTime;
      console.log(`Email sync completed for user ${user.email} (${duration}ms)`);
    } catch (error) {
      console.error('Email sync error:', error);
      throw error;
    }
  }

  private async getAllUsers(): Promise<User[]> {
    try {
      // Get all users from the database with proper typing
      const { db } = await import('../db.js');
      const { users } = await import('../../shared/schema.js');
      
      const allUsers = await db.select().from(users);
      
      // Filter out users without required tokens
      const validUsers = allUsers.filter((user): user is User => {
        return !!(user?.accessToken && user?.refreshToken && user?.email);
      });
      
      console.log(`Found ${allUsers.length} total users, ${validUsers.length} with valid tokens`);
      return validUsers;
    } catch (error) {
      console.error('Error getting all users:', error);
      return [];
    }
  }
}

// Export singleton instance
export const syncService = new SyncService();

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, stopping sync service...');
  syncService.stop();
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, stopping sync service...');
  syncService.stop();
});
