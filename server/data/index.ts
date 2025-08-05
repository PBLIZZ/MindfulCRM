import { UserData } from './user.data.js';
import { ContactData } from './contact.data.js';
import { InteractionData } from './interaction.data.js';
import { CalendarData } from './calendar.data.js';
import { EmailData } from './email.data.js';
import { TaskData } from './task.data.js';
import { AiData } from './ai.data.js';
import { MiscData } from './misc.data.js';
import type { CalendarEvent } from '../../shared/schema.js';

class Storage {
  public users = new UserData();
  public contacts = new ContactData();
  public interactions = new InteractionData();
  public calendar = new CalendarData();
  public emails = new EmailData();
  public tasks = new TaskData();
  public ai = new AiData();
  public misc = new MiscData();

  // AI Data Methods
  createDataProcessingJob = this.ai.createJob;
  updateDataProcessingJob = this.ai.updateJob;
  createAiSuggestion = this.ai.createSuggestion;
  updateAiSuggestion = this.ai.updateSuggestion;
  getAiSuggestion = this.ai.getSuggestionById;

  // Task Data Methods
  createTask = this.tasks.createTask;
  updateTask = this.tasks.updateTask;
  createTaskActivity = this.tasks.createTaskActivity;

  // Contact Data Methods
  getContact = this.contacts.getById;
  updateContact = this.contacts.update;
  getContactsByUserId = this.contacts.getByUserId;

  // Interaction Data Methods
  createInteraction = this.interactions.create;

  // Calendar Data Methods
  markEventProcessed = this.calendar.markEventProcessed;
  getEventHash = async (event: CalendarEvent) => this.calendar.getEventHash(event);
  shouldProcessEvent = this.calendar.shouldProcessEvent;
}

export const storage = new Storage();
