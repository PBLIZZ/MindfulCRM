import { google } from 'googleapis';
import { storage } from '../storage';
import type { User } from '@shared/schema';

export class GoogleService {
  private getOAuth2Client(user: User) {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID || process.env.OAUTH_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET || process.env.OAUTH_CLIENT_SECRET,
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

      // Get recent messages
      const response = await gmail.users.messages.list({
        userId: 'me',
        maxResults: 50,
        q: 'newer_than:7d'
      });

      const messages = response.data.messages || [];

      for (const message of messages) {
        if (!message.id) continue;

        const messageDetail = await gmail.users.messages.get({
          userId: 'me',
          id: message.id,
        });

        const headers = messageDetail.data.payload?.headers || [];
        const from = headers.find((h: any) => h.name === 'From')?.value || '';
        const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
        const date = headers.find((h: any) => h.name === 'Date')?.value;

        // Extract email address
        const emailMatch = from.match(/<(.+?)>/) || from.match(/(\S+@\S+)/);
        const email = emailMatch ? emailMatch[1] || emailMatch[0] : '';

        if (!email) continue;

        // Find or create contact
        const contacts = await storage.getContactsByUserId(user.id);
        let contact = contacts.find(c => c.email === email);

        if (!contact) {
          const name = from.replace(/<.*?>/, '').trim() || email;
          contact = await storage.createContact({
            userId: user.id,
            name,
            email,
            lastContact: new Date()
          });
        }

        // Create interaction
        await storage.createInteraction({
          contactId: contact.id,
          type: 'email',
          subject,
          content: subject || 'Email interaction',
          timestamp: date ? new Date(date) : new Date(),
          source: 'gmail',
          sourceId: message.id
        });
      }

      await storage.updateSyncStatus(user.id, 'gmail', {
        lastSync: new Date(),
        status: 'success'
      });
    } catch (error) {
      console.error('Gmail sync error:', error);
      await storage.updateSyncStatus(user.id, 'gmail', {
        lastSync: new Date(),
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async syncCalendar(user: User): Promise<void> {
    try {
      const oauth2Client = this.getOAuth2Client(user);
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: oneWeekAgo.toISOString(),
        timeMax: now.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      const events = response.data.items || [];

      for (const event of events) {
        if (!event.attendees || !event.summary) continue;

        for (const attendee of event.attendees) {
          if (!attendee.email || attendee.email === user.email) continue;

          // Find or create contact
          const contacts = await storage.getContactsByUserId(user.id);
          let contact = contacts.find(c => c.email === attendee.email);

          if (!contact) {
            contact = await storage.createContact({
              userId: user.id,
              name: attendee.displayName || attendee.email,
              email: attendee.email,
              lastContact: new Date()
            });
          }

          // Create interaction
          await storage.createInteraction({
            contactId: contact.id,
            type: 'meeting',
            subject: event.summary,
            content: `Meeting: ${event.summary}${event.description ? ` - ${event.description}` : ''}`,
            timestamp: event.start?.dateTime ? new Date(event.start.dateTime) : new Date(),
            source: 'calendar',
            sourceId: event.id
          });
        }
      }

      await storage.updateSyncStatus(user.id, 'calendar', {
        lastSync: new Date(),
        status: 'success'
      });
    } catch (error) {
      console.error('Calendar sync error:', error);
      await storage.updateSyncStatus(user.id, 'calendar', {
        lastSync: new Date(),
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async syncDrive(user: User): Promise<void> {
    try {
      const oauth2Client = this.getOAuth2Client(user);
      const drive = google.drive({ version: 'v3', auth: oauth2Client });

      // Search for documents (PDF, DOCX, TXT)
      const response = await drive.files.list({
        q: "mimeType='application/pdf' or mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document' or mimeType='text/plain'",
        fields: 'files(id, name, mimeType, modifiedTime)',
        orderBy: 'modifiedTime desc',
        pageSize: 50
      });

      const files = response.data.files || [];

      for (const file of files) {
        if (!file.id || !file.name) continue;

        // For now, we'll associate documents with the most recent contact
        // In a real implementation, you'd parse the document content to identify clients
        const contacts = await storage.getContactsByUserId(user.id);
        if (contacts.length === 0) continue;

        const contact = contacts[0]; // Associate with most recent contact

        // Check if document already exists
        const existingDocs = await storage.getDocumentsByContactId(contact.id);
        const exists = existingDocs.some(doc => doc.driveId === file.id);

        if (!exists) {
          await storage.createDocument({
            contactId: contact.id,
            name: file.name,
            type: file.mimeType || 'unknown',
            driveId: file.id,
            url: `https://drive.google.com/file/d/${file.id}/view`
          });
        }
      }

      await storage.updateSyncStatus(user.id, 'drive', {
        lastSync: new Date(),
        status: 'success'
      });
    } catch (error) {
      console.error('Drive sync error:', error);
      await storage.updateSyncStatus(user.id, 'drive', {
        lastSync: new Date(),
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

export const googleService = new GoogleService();
