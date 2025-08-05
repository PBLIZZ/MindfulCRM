import { google } from 'googleapis';
import type { calendar_v3 } from 'googleapis';
import { storage } from '../data/index.js'; // <-- CORRECTED IMPORT
import type { User } from '../../shared/schema.js';

// Extended event type that properly extends Google's Schema$Event
type ExtendedCalendarEvent = calendar_v3.Schema$Event & {
  calendarId?: string | null;
  calendarName?: string | null;
  calendarColor?: string | null;
};

export class GoogleService {
  private getOAuth2Client(user: User) {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_OAUTH_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_CALLBACK_URL
    );

    oauth2Client.setCredentials({
      access_token: user.accessToken,
      refresh_token: user.refreshToken,
    });

    return oauth2Client;
  }

  async syncGmail(user: User): Promise<void> {
    try {
      const oauth2Client = this.getOAuth2Client(user);
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      const response = await gmail.users.messages.list({
        userId: 'me',
        maxResults: 50,
        q: 'newer_than:7d',
      });

      const messages = response.data.messages ?? [];

      for (const message of messages) {
        if (!message.id) continue;

        const messageDetail = await gmail.users.messages.get({
          userId: 'me',
          id: message.id,
        });

        const headers = messageDetail.data.payload?.headers ?? [];
        const from = headers.find((h) => h.name === 'From')?.value ?? '';
        const subject = headers.find((h) => h.name === 'Subject')?.value ?? '';
        const date = headers.find((h) => h.name === 'Date')?.value;

        const emailMatch = from.match(/<(.+?)>/) ?? from.match(/(\S+@\S+)/);
        const email = emailMatch ? emailMatch[1] ?? emailMatch[0] : '';

        if (!email) continue;

        const contacts = await storage.contacts.getByUserId(user.id); // <-- CORRECTED CALL
        let contact = contacts.find((c) => c.email === email);

        if (!contact) {
          const name = from.replace(/<.*?>/, '').trim() ?? email;
          const createdContact = await storage.contacts.create({
            // <- CORRECTED CALL
            userId: user.id,
            name,
            email,
            lastContact: new Date(),
          });
          // Add empty tags array to match expected type
          contact = { ...createdContact, tags: [] };
        }

        await storage.interactions.create({
          // <- CORRECTED CALL
          contactId: contact!.id,
          type: 'email',
          subject,
          content: subject ?? 'Email interaction',
          timestamp: date ? new Date(date) : new Date(),
          source: 'gmail',
          sourceId: message.id,
        });
      }

      await storage.misc.updateSyncStatus(user.id, 'gmail', {
        // <-- CORRECTED CALL
        lastSync: new Date(),
        status: 'success',
      });
    } catch (error) {
      console.error('Gmail sync error:', error);
      await storage.misc.updateSyncStatus(user.id, 'gmail', {
        // <-- CORRECTED CALL
        lastSync: new Date(),
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async syncCalendar(
    user: User,
    options?: {
      startDate?: Date;
      endDate?: Date;
      syncType?: 'initial' | 'incremental';
    }
  ): Promise<void> {
    try {
      const oauth2Client = this.getOAuth2Client(user);
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      const now = new Date();
      const syncType = options?.syncType ?? 'incremental';

      let startDate: Date;
      let endDate: Date;

      if (syncType === 'initial') {
        startDate = options?.startDate ?? new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        endDate = options?.endDate ?? new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);
      } else {
        startDate = options?.startDate ?? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        endDate = options?.endDate ?? new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);
      }

      console.log(
        `${syncType} sync for user ${
          user.email
        } from ${startDate.toISOString()} to ${endDate.toISOString()}`
      );

      const calendarListResponse = await calendar.calendarList.list();
      const calendars = calendarListResponse.data.items ?? [];
      console.log(`Found ${calendars.length} calendars for user`);

      let allEvents: ExtendedCalendarEvent[] = [];

      for (const cal of calendars) {
        if (!cal.id) continue;
        try {
          const response = await calendar.events.list({
            calendarId: cal.id,
            timeMin: startDate.toISOString(),
            timeMax: endDate.toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
            maxResults: 2500,
          });

          const calendarEvents = (response.data.items ?? []).map((event) => ({
            ...event,
            calendarId: cal.id,
            calendarName: cal.summary ?? cal.id,
            calendarColor: cal.backgroundColor ?? cal.colorId ?? '#4285f4',
          }));

          allEvents = allEvents.concat(calendarEvents);
          console.log(`Found ${calendarEvents.length} events in calendar: ${cal.summary}`);
        } catch (error) {
          console.error(`Error fetching events from calendar ${cal.summary}:`, error);
        }
      }

      console.log(`Found ${allEvents.length} total calendar events to process`);
      const events = allEvents;
      let newEventsCount = 0;
      let updatedEventsCount = 0;

      for (const event of events) {
        if (!event.id) continue;

        const existingEvent = await storage.calendar.findByGoogleId(user.id, event.id); // <-- CORRECTED CALL

        let meetingType = 'in-person';
        if (
          event.location?.includes('zoom') ||
          event.location?.includes('meet.google.com') ||
          event.description?.includes('zoom') ||
          event.description?.includes('meet.google.com')
        ) {
          meetingType = 'video';
        } else if (event.location?.includes('phone') || event.description?.includes('phone')) {
          meetingType = 'phone';
        }

        const eventData = {
          userId: user.id,
          googleEventId: event.id,
          rawData: event,
          summary: event.summary ?? null,
          description: event.description ?? null,
          startTime: event.start?.dateTime
            ? new Date(event.start.dateTime)
            : event.start?.date
            ? new Date(event.start.date)
            : null,
          endTime: event.end?.dateTime
            ? new Date(event.end.dateTime)
            : event.end?.date
            ? new Date(event.end.date)
            : null,
          attendees: event.attendees ?? null,
          location: event.location ?? null,
          meetingType,
          processed: false,
          extractedData: null,
          contactId: null,
          calendarId: event.calendarId ?? null,
          calendarName: event.calendarName ?? null,
          calendarColor: event.calendarColor ?? null,
        };

        if (existingEvent) {
          const needsUpdate =
            JSON.stringify(existingEvent.rawData) !== JSON.stringify(event) ||
            !existingEvent.calendarName ||
            !existingEvent.calendarColor;

          if (needsUpdate) {
            await storage.calendar.update(existingEvent.id, {
              // <-- CORRECTED CALL
              rawData: event,
              summary: eventData.summary,
              description: eventData.description,
              startTime: eventData.startTime,
              endTime: eventData.endTime,
              attendees: eventData.attendees,
              location: eventData.location,
              meetingType: eventData.meetingType,
              processed: false,
              calendarId: eventData.calendarId,
              calendarName: eventData.calendarName,
              calendarColor: eventData.calendarColor,
            });
            updatedEventsCount++;
          }
        } else {
          await storage.calendar.create(eventData); // <-- CORRECTED CALL
          newEventsCount++;
        }

        if (event.attendees && event.summary) {
          for (const attendee of event.attendees) {
            if (!attendee.email || attendee.email === user.email) continue;

            const contacts = await storage.contacts.getByUserId(user.id); // <-- CORRECTED CALL
            let contact = contacts.find((c) => c.email === attendee.email);

            if (!contact) {
              const createdContact = await storage.contacts.create({
                // <- CORRECTED CALL
                userId: user.id,
                name: attendee.displayName ?? attendee.email,
                email: attendee.email,
                lastContact: new Date(),
              });
              // Add empty tags array to match expected type
              contact = { ...createdContact, tags: [] };
            }

            const existingInteractions = await storage.interactions.getByContactId(contact.id); // <- CORRECTED CALL
            const hasExistingInteraction = existingInteractions.some(
              (i) => i.sourceId === event.id
            );

            if (!hasExistingInteraction) {
              await storage.interactions.create({
                // <- CORRECTED CALL
                contactId: contact.id,
                type: 'meeting',
                subject: event.summary,
                content: `Meeting: ${event.summary}${
                  event.description ? ` - ${event.description}` : ''
                }`,
                timestamp: event.start?.dateTime ? new Date(event.start.dateTime) : new Date(),
                source: 'calendar',
                sourceId: event.id,
              });
            }
          }
        }
      }

      console.log(
        `Calendar sync completed: ${newEventsCount} new events, ${updatedEventsCount} updated events`
      );

      await storage.misc.updateSyncStatus(user.id, 'calendar', {
        // <-- CORRECTED CALL
        lastSync: new Date(),
        status: 'success',
      });
    } catch (error) {
      console.error('Calendar sync error:', error);
      await storage.misc.updateSyncStatus(user.id, 'calendar', {
        // <-- CORRECTED CALL
        lastSync: new Date(),
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async syncDrive(user: User): Promise<void> {
    try {
      const oauth2Client = this.getOAuth2Client(user);
      const drive = google.drive({ version: 'v3', auth: oauth2Client });

      const response = await drive.files.list({
        q: "mimeType='application/pdf' or mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document' or mimeType='text/plain'",
        fields: 'files(id, name, mimeType, modifiedTime)',
        orderBy: 'modifiedTime desc',
        pageSize: 50,
      });

      const files = response.data.files ?? [];

      for (const file of files) {
        if (!file.id || !file.name) continue;

        const contacts = await storage.contacts.getByUserId(user.id); // <-- CORRECTED CALL
        if (contacts.length === 0) continue;

        const contact = contacts[0];

        const existingDocs = await storage.misc.getDocumentsByContactId(contact.id); // <-- CORRECTED CALL
        const exists = existingDocs.some((doc) => doc.driveId === file.id);

        if (!exists) {
          await storage.misc.createDocument({
            // <-- CORRECTED CALL
            contactId: contact.id,
            name: file.name,
            type: file.mimeType ?? 'unknown',
            driveId: file.id,
            url: `https://drive.google.com/file/d/${file.id}/view`,
          });
        }
      }

      await storage.misc.updateSyncStatus(user.id, 'drive', {
        // <-- CORRECTED CALL
        lastSync: new Date(),
        status: 'success',
      });
    } catch (error) {
      console.error('Drive sync error:', error);
      await storage.misc.updateSyncStatus(user.id, 'drive', {
        // <-- CORRECTED CALL
        lastSync: new Date(),
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export const googleService = new GoogleService();
