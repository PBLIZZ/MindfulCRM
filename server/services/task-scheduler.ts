import cron from 'node-cron';
import { storage } from '../storage';
import { taskAI } from './task-ai';
import { googleService } from './google';
import fs from 'fs/promises';
import path from 'path';

export class TaskScheduler {
  private isRunning = false;

  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    console.log('Starting task scheduler service...');

    // Run AI analysis at 4 AM daily
    cron.schedule('0 4 * * *', async () => {
      console.log('Running daily AI analysis at 4 AM...');
      await this.runDailyAIAnalysis();
    });

    // Check for new data every hour during business hours (8 AM - 8 PM)
    cron.schedule('0 8-20 * * *', async () => {
      console.log('Checking for new data to process...');
      await this.checkForNewData();
    });

    // Process pending AI suggestions every 30 minutes
    cron.schedule('*/30 * * * *', async () => {
      await this.processPendingTasks();
    });
  }

  stop(): void {
    this.isRunning = false;
    console.log('Task scheduler stopped');
  }

  /**
   * Run comprehensive daily AI analysis
   */
  private async runDailyAIAnalysis(): Promise<void> {
    try {
      console.log('Starting daily AI analysis...');

      // Get all users for processing
      const users = await this.getAllActiveUsers();

      for (const user of users) {
        try {
          console.log(`Running AI analysis for user: ${user.email}`);

          // Check for new Google Drive files (CSV attendance sheets)
          await this.checkForNewAttendanceSheets(user.id);

          // Check for new photo enrichment opportunities
          await this.checkForPhotoEnrichmentOpportunities(user.id);

          // Analyze recent email patterns for task suggestions
          await this.analyzeEmailPatternsForTasks(user.id);

          // Review incomplete tasks and suggest next steps
          await this.reviewIncompleteTasks(user.id);
        } catch (error) {
          console.error(`Daily analysis failed for user ${user.email}:`, error);
        }
      }

      console.log('Daily AI analysis completed');
    } catch (error) {
      console.error('Daily AI analysis error:', error);
    }
  }

  /**
   * Check for new data throughout the day
   */
  private async checkForNewData(): Promise<void> {
    try {
      const users = await this.getAllActiveUsers();

      for (const user of users) {
        // Quick check for new files or data that need processing
        await this.quickDataCheck(user.id);
      }
    } catch (error) {
      console.error('New data check error:', error);
    }
  }

  /**
   * Process pending AI tasks and suggestions
   */
  private async processPendingTasks(): Promise<void> {
    try {
      // Process tasks assigned to AI that are in progress
      const aiTasks = await storage.getTasksByStatus('in_progress', 'ai_assistant');

      for (const task of aiTasks) {
        // Check if task has been processing for too long
        const hoursInProgress =
          (Date.now() - new Date(task.updatedAt).getTime()) / (1000 * 60 * 60);

        if (hoursInProgress > 1) {
          // If processing for more than 1 hour
          console.log(`Processing stalled AI task: ${task.title}`);
          // Could retry or mark as failed
        }
      }

      // Clean up old completed suggestions
      await this.cleanupOldSuggestions();
    } catch (error) {
      console.error('Pending tasks processing error:', error);
    }
  }

  /**
   * Check for new attendance sheets in Google Drive
   */
  private async checkForNewAttendanceSheets(userId: string): Promise<void> {
    try {
      // This would integrate with Google Drive API to check for new CSV files
      // For now, we'll simulate checking a monitored folder

      const monitoredFolder = `/uploads/attendance/${userId}`;

      try {
        const files = await fs.readdir(monitoredFolder);
        const csvFiles = files.filter(
          (file) => file.endsWith('.csv') && file.includes('attendance')
        );

        for (const csvFile of csvFiles) {
          const filePath = path.join(monitoredFolder, csvFile);
          const stats = await fs.stat(filePath);

          // Check if file is new (created in last 24 hours)
          const isNewFile = Date.now() - stats.mtime.getTime() < 24 * 60 * 60 * 1000;

          if (isNewFile) {
            console.log(`Processing new attendance file: ${csvFile}`);
            const csvData = await fs.readFile(filePath, 'utf-8');
            await taskAI.processAttendanceCSV(userId, csvData, csvFile);
          }
        }
      } catch (error) {
        // Folder doesn't exist or no files, which is fine
        console.log(`No attendance folder found for user ${userId}`);
      }
    } catch (error) {
      console.error(`Error checking attendance sheets for user ${userId}:`, error);
    }
  }

  /**
   * Check for photo enrichment opportunities
   */
  private async checkForPhotoEnrichmentOpportunities(userId: string): Promise<void> {
    try {
      // Get contacts without photos who have GDPR consent
      const contacts = await storage.getContactsByUserId(userId);
      const contactsNeedingPhotos = contacts.filter(
        (contact) =>
          !contact.avatarUrl && contact.hasGdprConsent && contact.allowProfilePictureScraping
      );

      if (contactsNeedingPhotos.length > 0) {
        console.log(
          `Found ${contactsNeedingPhotos.length} contacts needing photos for user ${userId}`
        );

        // Simulate photo enrichment results
        const photoResults = contactsNeedingPhotos.slice(0, 5).map((contact) => ({
          contactId: contact.id,
          photoUrl: contact.email
            ? `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(contact.name)}`
            : null,
          source: 'ai_generated',
        }));

        if (photoResults.some((r) => r.photoUrl)) {
          await taskAI.processNewPhotos(userId, photoResults);
        }
      }
    } catch (error) {
      console.error(`Error checking photo opportunities for user ${userId}:`, error);
    }
  }

  /**
   * Analyze email patterns to suggest tasks
   */
  private async analyzeEmailPatternsForTasks(userId: string): Promise<void> {
    try {
      // Get recent emails
      const recentEmails = await storage.getRecentEmails(userId, 7); // Last 7 days

      if (recentEmails.length > 0) {
        // Analyze for patterns that might suggest tasks
        const followUpNeeded = recentEmails.filter(
          (email) =>
            email.bodyText?.toLowerCase().includes('follow up') ||
            email.bodyText?.toLowerCase().includes('get back to')
        );

        const eventMentions = recentEmails.filter(
          (email) =>
            email.bodyText?.toLowerCase().includes('workshop') ||
            email.bodyText?.toLowerCase().includes('retreat') ||
            email.bodyText?.toLowerCase().includes('class')
        );

        // Create suggestions based on patterns
        if (followUpNeeded.length > 2) {
          await storage.createAiSuggestion({
            userId,
            type: 'task_creation',
            title: 'Create follow-up tasks?',
            description: `I noticed ${followUpNeeded.length} emails mentioning follow-ups in the last week. Should I create tasks to track these?`,
            suggestedAction: {
              type: 'create_follow_up_tasks',
              emails: followUpNeeded.map((e) => ({ id: e.id, subject: e.subject })),
            },
            sourceData: { followUpEmails: followUpNeeded.length },
            aiAnalysis: { pattern: 'follow_up_pattern', confidence: 0.8 },
            priority: 'medium',
          });
        }

        if (eventMentions.length > 1) {
          await storage.createAiSuggestion({
            userId,
            type: 'task_creation',
            title: 'Plan event communications?',
            description: `Multiple emails mention events/workshops. Should I help create a communication plan?`,
            suggestedAction: {
              type: 'create_event_tasks',
              events: eventMentions.map((e) => ({ id: e.id, subject: e.subject })),
            },
            sourceData: { eventEmails: eventMentions.length },
            aiAnalysis: { pattern: 'event_planning_pattern', confidence: 0.7 },
            priority: 'medium',
          });
        }
      }
    } catch (error) {
      console.error(`Error analyzing email patterns for user ${userId}:`, error);
    }
  }

  /**
   * Review incomplete tasks and suggest next steps
   */
  private async reviewIncompleteTasks(userId: string): Promise<void> {
    try {
      const incompleteTasks = await storage.getTasksByUserId(userId, ['pending', 'in_progress']);
      const overdueTasks = incompleteTasks.filter(
        (task) => task.dueDate && new Date(task.dueDate) < new Date()
      );

      if (overdueTasks.length > 0) {
        await storage.createAiSuggestion({
          userId,
          type: 'task_review',
          title: `Review ${overdueTasks.length} overdue tasks?`,
          description: `You have ${overdueTasks.length} overdue tasks. Should I help prioritize or reschedule them?`,
          suggestedAction: {
            type: 'task_review',
            overdueTasks: overdueTasks.map((t) => ({
              id: t.id,
              title: t.title,
              dueDate: t.dueDate,
            })),
          },
          sourceData: { overdueCount: overdueTasks.length },
          aiAnalysis: {
            urgentTasks: overdueTasks.filter((t) => t.priority === 'urgent').length,
            oldestTask: overdueTasks.reduce((oldest, task) =>
              new Date(task.dueDate!) < new Date(oldest.dueDate!) ? task : oldest
            ),
          },
          priority: 'high',
        });
      }
    } catch (error) {
      console.error(`Error reviewing incomplete tasks for user ${userId}:`, error);
    }
  }

  /**
   * Quick check for new data without heavy processing
   */
  private async quickDataCheck(userId: string): Promise<void> {
    try {
      // Check for any data processing jobs that failed and might need retry
      const failedJobs = await storage.getFailedDataProcessingJobs(userId);

      if (failedJobs.length > 0) {
        console.log(`Found ${failedJobs.length} failed jobs for user ${userId}`);
        // Could create suggestions to retry or manual review
      }
    } catch (error) {
      console.error(`Quick data check error for user ${userId}:`, error);
    }
  }

  /**
   * Clean up old suggestions and completed jobs
   */
  private async cleanupOldSuggestions(): Promise<void> {
    try {
      // Remove suggestions older than 30 days that are completed/rejected
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      await storage.cleanupOldSuggestions(thirtyDaysAgo);
      await storage.cleanupOldDataProcessingJobs(thirtyDaysAgo);
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }

  /**
   * Get all active users for processing
   */
  private async getAllActiveUsers(): Promise<Array<{ id: string; email: string }>> {
    try {
      // Get users who have been active in the last 30 days
      const users = await storage.getActiveUsers(30);
      return users;
    } catch (error) {
      console.error('Error getting active users:', error);
      return [];
    }
  }

  /**
   * Manual trigger for immediate processing
   */
  async triggerImmediateAnalysis(userId: string): Promise<void> {
    console.log(`Triggering immediate analysis for user ${userId}`);

    try {
      await this.checkForNewAttendanceSheets(userId);
      await this.checkForPhotoEnrichmentOpportunities(userId);
      await this.analyzeEmailPatternsForTasks(userId);
      await this.reviewIncompleteTasks(userId);

      console.log(`Immediate analysis completed for user ${userId}`);
    } catch (error) {
      console.error(`Immediate analysis failed for user ${userId}:`, error);
      throw error;
    }
  }
}

export const taskScheduler = new TaskScheduler();
