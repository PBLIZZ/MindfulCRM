import { storage } from '../storage.js';
import { llmProcessor } from './llm-processor.js';
import type { Task, AiSuggestion, Contact } from '../../shared/schema.js';
import type {
  AttendanceRecord,
  AttendanceAnalysis,
  TaskAnalysis,
  BulkAction,
} from '../types/llm-types.js';
import { format } from 'date-fns';

// Type guard function for BulkAction
function isBulkAction(action: unknown): action is BulkAction {
  if (typeof action !== 'object' || action === null) {
    return false;
  }
  
  const actionObj = action as Record<string, unknown>;
  
  return (
    'type' in actionObj &&
    'contactIds' in actionObj &&
    typeof actionObj.type === 'string' &&
    Array.isArray(actionObj.contactIds) &&
    ['bulk_timeline_update', 'bulk_photo_update', 'bulk_contact_update'].includes(
      actionObj.type
    )
  );
}

export class TaskAIService {
  constructor() {}

  /**
   * Process CSV attendance data and generate AI suggestions
   */
  async processAttendanceCSV(
    userId: string,
    csvData: string,
    fileName: string
  ): Promise<AiSuggestion[]> {
    console.log(`Processing attendance CSV: ${fileName} for user ${userId}`);

    try {
      // Create data processing job
      const job = await storage.createDataProcessingJob({
        userId,
        jobType: 'attendance_csv',
        sourceType: 'manual_upload',
        sourceReference: fileName,
        status: 'processing',
        startedAt: new Date(),
        inputData: { csvData, fileName },
      });

      // Parse CSV data
      const attendanceData = this.parseCSVAttendance(csvData);
      const affectedContacts = await this.matchContactsFromAttendance(userId, attendanceData);

      // Generate AI analysis
      const aiAnalysis = await this.generateAttendanceAnalysis(attendanceData, affectedContacts);

      // Create AI suggestion
      const suggestion = await storage.createAiSuggestion({
        userId,
        type: 'contact_update',
        title: `Add ${fileName} to ${affectedContacts.length} client timelines?`,
        description: `A new attendance sheet was uploaded. Should I add this class attendance to the timelines of the ${affectedContacts.length} clients listed?`,
        suggestedAction: {
          type: 'bulk_timeline_update',
          contactIds: affectedContacts.map((c) => c.id),
          eventType: 'class_attendance',
          eventData: {
            className: this.extractClassNameFromFilename(fileName),
            date: this.extractDateFromFilename(fileName),
            attendees: attendanceData.attendees,
          },
        },
        sourceData: { csvData, fileName, attendanceData },
        aiAnalysis,
        priority: 'medium',
      });

      // Update job status
      await storage.updateDataProcessingJob(job.id, {
        status: 'completed',
        completedAt: new Date(),
        outputData: { suggestionId: suggestion.id },
        suggestionsGenerated: 1,
      });

      return [suggestion];
    } catch (error) {
      console.error('Error processing attendance CSV:', error);
      throw error;
    }
  }

  /**
   * Process new photos with GDPR consent and generate suggestions
   */
  async processNewPhotos(
    userId: string,
    photoData: { contactId: string; photoUrl: string; source: string }[]
  ): Promise<AiSuggestion[]> {
    console.log(`Processing ${photoData.length} new photos for user ${userId}`);

    try {
      const job = await storage.createDataProcessingJob({
        userId,
        jobType: 'photo_gdpr',
        sourceType: 'ai_enrichment',
        sourceReference: `${photoData.length}_photos`,
        status: 'processing',
        startedAt: new Date(),
        inputData: { photoData },
      });

      const successfulPhotos = photoData.filter((p) => p.photoUrl);
      const failedPhotos = photoData.filter((p) => !p.photoUrl);

      if (successfulPhotos.length > 0) {
        const suggestion = await storage.createAiSuggestion({
          userId,
          type: 'contact_update',
          title: `Add new photos for ${successfulPhotos.length} clients?`,
          description: `GDPR consent was activated and new photos are available for ${successfulPhotos.length} clients. ${failedPhotos.length} photo lookups returned no results. Shall I add the available photos to the respective client records?`,
          suggestedAction: {
            type: 'bulk_photo_update',
            updates: successfulPhotos.map((p) => ({
              contactId: p.contactId,
              photoUrl: p.photoUrl,
              source: p.source,
            })),
          },
          sourceData: { photoData },
          aiAnalysis: {
            successCount: successfulPhotos.length,
            failureCount: failedPhotos.length,
            sources: Array.from(new Set(successfulPhotos.map((p) => p.source))),
          },
          priority: 'low',
        });

        await storage.updateDataProcessingJob(job.id, {
          status: 'completed',
          completedAt: new Date(),
          outputData: { suggestionId: suggestion.id },
          suggestionsGenerated: 1,
        });

        return [suggestion];
      }

      await storage.updateDataProcessingJob(job.id, {
        status: 'completed',
        completedAt: new Date(),
        outputData: { message: 'No photos to process' },
        suggestionsGenerated: 0,
      });

      return [];
    } catch (error) {
      console.error('Error processing new photos:', error);
      throw error;
    }
  }

  /**
   * Create and delegate task to AI assistant
   */
  async delegateTaskToAI(
    userId: string,
    taskData: {
      title: string;
      description: string;
      contactIds: string[];
      dueDate?: Date;
      projectId?: string;
      priority?: 'low' | 'medium' | 'high' | 'urgent';
    }
  ): Promise<Task> {
    console.log(`Delegating task to AI: ${taskData.title}`);

    // Create the main task assigned to AI
    const task = await storage.createTask({
      userId,
      title: taskData.title,
      description: taskData.description,
      owner: 'ai_assistant',
      status: 'in_progress',
      priority: taskData.priority ?? 'medium',
      dueDate: taskData.dueDate,
      projectId: taskData.projectId,
      assignedContactIds: taskData.contactIds,
      isAiGenerated: false,
    });

    // Log task creation activity
    await storage.createTaskActivity({
      taskId: task.id,
      actorType: 'user',
      actorId: userId,
      actionType: 'delegated_to_ai',
      description: `Task delegated to AI assistant: ${taskData.title}`,
      metadata: { originalTaskData: taskData },
    });

    // Start AI processing in background
    this.processAIDelegatedTask(task).catch((error) => {
      console.error(`Error processing AI task ${task.id}:`, error);
    });

    return task;
  }

  /**
   * Process AI-delegated task in background
   */
  private async processAIDelegatedTask(task: Task): Promise<void> {
    try {
      // Get contact data for analysis
      const contacts = await Promise.all(
        (task.assignedContactIds as string[]).map((id) => storage.getContact(id))
      );
      const validContacts = contacts.filter(Boolean) as Contact[];

      // Generate AI analysis based on task type
      const aiAnalysis = await this.generateTaskAnalysis(task, validContacts);

      // Create subtasks or generate deliverables based on task content
      const subtasks = await this.generateSubtasks(task, validContacts, aiAnalysis);

      // Update task with AI analysis
      await storage.updateTask(task.id, {
        aiAnalysis,
        status: subtasks.length > 0 ? 'in_progress' : 'completed',
      });

      // Log AI processing activity
      await storage.createTaskActivity({
        taskId: task.id,
        actorType: 'ai_assistant',
        actionType: 'ai_processed',
        description: `AI generated ${subtasks.length} deliverables for task`,
        metadata: {
          aiAnalysis,
          subtasksCreated: subtasks.length,
          contactsAnalyzed: validContacts.length,
        },
      });

      // If task involves email creation, generate drafts
      if (
        task.title.toLowerCase().includes('email') ||
        task.description?.toLowerCase().includes('email')
      ) {
        await this.generateEmailDrafts(task, validContacts, aiAnalysis);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error(`Error processing AI task ${task.id}:`, errorMessage);

      await storage.updateTask(task.id, {
        status: 'cancelled',
        aiAnalysis: { error: errorMessage },
      });

      await storage.createTaskActivity({
        taskId: task.id,
        actorType: 'ai_assistant',
        actionType: 'failed',
        description: `AI processing failed: ${errorMessage}`,
        metadata: { error: errorMessage },
      });
    }
  }

  /**
   * Execute approved AI suggestion
   */
  async executeAISuggestion(suggestionId: string): Promise<boolean> {
    try {
      const suggestion = await storage.getAiSuggestion(suggestionId);
      if (!suggestion || suggestion.status !== 'approved') {
        throw new Error('Suggestion not found or not approved');
      }

      // Use type guard for suggestion action
      const action = suggestion.suggestedAction;

      if (!isBulkAction(action)) {
        throw new Error('Invalid suggestion action - not a valid BulkAction');
      }

      switch (action.type) {
        case 'bulk_timeline_update':
          await this.executeBulkTimelineUpdate(action);
          break;
        case 'bulk_photo_update':
          await this.executeBulkPhotoUpdate(action);
          break;
        case 'bulk_contact_update':
          // Add implementation for contact updates if needed
          throw new Error('Contact update not yet implemented');
        default:
          throw new Error(`Unknown action type: ${action.type}`);
      }

      await storage.updateAiSuggestion(suggestionId, {
        status: 'executed',
        executedAt: new Date(),
      });

      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Error executing AI suggestion:', errorMessage);
      await storage.updateAiSuggestion(suggestionId, {
        status: 'rejected',
        rejectionReason: errorMessage,
      });
      return false;
    }
  }

  // Helper methods
  private parseCSVAttendance(csvData: string): AttendanceRecord {
    const lines = csvData.trim().split('\n');
    const attendeeNames = lines
      .slice(1) // Skip header
      .map((line) => line.split(',')[0]?.trim())
      .filter(Boolean);

    // Convert string names to AttendeeData objects
    const attendees = attendeeNames.map((name) => ({ name }));

    return { attendees };
  }

  private async matchContactsFromAttendance(
    userId: string,
    attendanceData: AttendanceRecord
  ): Promise<Contact[]> {
    const allContacts = await storage.getContactsByUserId(userId);

    return allContacts.filter((contact) =>
      attendanceData.attendees.some(
        (attendee) =>
          contact.name.toLowerCase().includes(attendee.name.toLowerCase()) ||
          attendee.name.toLowerCase().includes(contact.name.toLowerCase())
      )
    );
  }

  private extractClassNameFromFilename(fileName: string): string {
    // Extract class name from filename like "tuesday_yoga_attendance_2025-08-26.csv"
    const parts = fileName.replace('.csv', '').split('_');
    if (parts.length >= 2) {
      return `${parts[0]} ${parts[1]}`.replace(/^\w/, (c) => c.toUpperCase());
    }
    return 'Class';
  }

  private extractDateFromFilename(fileName: string): string {
    // Extract date from filename
    const dateMatch = fileName.match(/(\d{4}-\d{2}-\d{2})/);
    return dateMatch ? dateMatch[1] : format(new Date(), 'yyyy-MM-dd');
  }

  private async generateAttendanceAnalysis(
    attendanceData: AttendanceRecord,
    contacts: Contact[]
  ): Promise<AttendanceAnalysis> {
    return {
      attendeeCount: attendanceData.attendees.length,
      matchedContacts: contacts.length,
      unmatchedAttendees: attendanceData.attendees
        .filter(
          (attendee) =>
            !contacts.some((contact) =>
              contact.name.toLowerCase().includes(attendee.name.toLowerCase())
            )
        )
        .map((attendee) => attendee.name),
      analysis: `Processed attendance data with ${attendanceData.attendees.length} attendees, successfully matched ${contacts.length} to existing contacts.`,
    };
  }

  private async generateTaskAnalysis(task: Task, contacts: Contact[]): Promise<TaskAnalysis> {
    const prompt = `
Analyze this task for a wellness professional:

Task: ${task.title}
Description: ${task.description}
Assigned to ${contacts.length} contacts:
${contacts.map((c) => `- ${c.name} (${c.lifecycleStage ?? 'unknown stage'})`).join('\n')}

Provide analysis and recommendations for how to complete this task effectively.
Consider the lifecycle stages of the contacts and suggest personalized approaches.

Return JSON with: {
  "strategy": "overall approach",
  "contactSegments": [{"segment": "name", "contacts": ["names"], "approach": "specific approach"}],
  "recommendations": ["actionable recommendations"],
  "estimatedTime": "time estimate in minutes"
}`;

    try {
      const response = await llmProcessor.processPrompt(prompt, task.userId);
      return JSON.parse(response) as TaskAnalysis;
    } catch {
      return {
        strategy: 'Standard approach for all contacts',
        contactSegments: [
          { segment: 'all', contacts: contacts.map((c) => c.name), approach: 'uniform approach' },
        ],
        recommendations: ['Process contacts individually', 'Follow standard procedures'],
        estimatedTime: '30-60 minutes',
      };
    }
  }

  private async generateSubtasks(
    task: Task,
    contacts: Contact[],
    aiAnalysis: TaskAnalysis
  ): Promise<Task[]> {
    const subtasks: Task[] = [];

    // Generate subtasks based on contact segments from AI analysis
    if (aiAnalysis.contactSegments && Array.isArray(aiAnalysis.contactSegments)) {
      for (const segment of aiAnalysis.contactSegments) {
        const segmentContactIds = contacts
          .filter((c) => segment.contacts.includes(c.name))
          .map((c) => c.id);

        if (segmentContactIds.length > 0) {
          const subtask = await storage.createTask({
            userId: task.userId,
            parentTaskId: task.id,
            title: `${task.title} - ${segment.segment}`,
            description: segment.approach,
            owner: 'ai_assistant',
            status: 'completed', // AI completes analysis subtasks immediately
            assignedContactIds: segmentContactIds,
            isAiGenerated: true,
            aiAnalysis: { segment: segment.segment, approach: segment.approach },
          });

          subtasks.push(subtask);
        }
      }
    }

    return subtasks;
  }

  private async generateEmailDrafts(
    task: Task,
    contacts: Contact[],
    aiAnalysis: TaskAnalysis
  ): Promise<void> {
    // Create a completion task with email drafts
    const completionTask = await storage.createTask({
      userId: task.userId,
      parentTaskId: task.id,
      title: `Email Drafts Ready for Review - ${task.title}`,
      description: `AI has generated personalized email drafts based on your task requirements. Review and send as needed.`,
      owner: 'user', // Hand back to user for review
      status: 'pending',
      priority: task.priority,
      isAiGenerated: true,
      aiAnalysis: {
        emailDrafts: contacts.map((contact) => ({
          contactId: contact.id,
          contactName: contact.name,
          subject: this.generateEmailSubject(task, contact),
          body: this.generateEmailBody(task, contact, aiAnalysis),
        })),
      },
    });

    await storage.createTaskActivity({
      taskId: completionTask.id,
      actorType: 'ai_assistant',
      actionType: 'email_drafts_generated',
      description: `Generated ${contacts.length} personalized email drafts`,
      metadata: {
        originalTaskId: task.id,
        draftsCount: contacts.length,
        contacts: contacts.map((c) => ({ id: c.id, name: c.name })),
      },
    });
  }

  private generateEmailSubject(task: Task, contact: Contact): string {
    // Generate personalized subject based on task and contact
    const taskType = task.title.toLowerCase();

    if (taskType.includes('retreat')) {
      return `Special invitation for you, ${contact.name}`;
    } else if (taskType.includes('workshop')) {
      return `${contact.name}, join our upcoming workshop`;
    } else if (taskType.includes('follow')) {
      return `Hope you're doing well, ${contact.name}`;
    }

    return `Personal message for ${contact.name}`;
  }

  private generateEmailBody(task: Task, contact: Contact, aiAnalysis: TaskAnalysis): string {
    // Generate personalized email body
    const segment = aiAnalysis.contactSegments?.find((s) => s.contacts.includes(contact.name));

    return `Hi ${contact.name},

${task.description ?? 'I wanted to reach out with a personal message.'}

${segment ? segment.approach : 'I hope this message finds you well.'}

Best regards,
Your Wellness Team

---
This email was personalized based on your relationship stage: ${
      contact.lifecycleStage ?? 'valued client'
    }`;
  }

  private async executeBulkTimelineUpdate(action: BulkAction): Promise<void> {
    // Implementation for bulk timeline updates
    if (!action.eventData) {
      throw new Error('Event data is required for timeline updates');
    }

    for (const contactId of action.contactIds) {
      await storage.createInteraction({
        contactId,
        type: 'class_attendance',
        content: `Attended ${action.eventData.className} - Class attendance recorded from ${action.eventData.date}`,
        timestamp: new Date(action.eventData.date),
      });
    }
  }

  private async executeBulkPhotoUpdate(action: BulkAction): Promise<void> {
    // Implementation for bulk photo updates
    if (!action.updates) {
      throw new Error('Updates array is required for photo updates');
    }

    for (const update of action.updates) {
      await storage.updateContact(update.contactId, {
        avatarUrl: update.photoUrl,
      });
    }
  }
}

export const taskAI = new TaskAIService();
