import { google } from 'googleapis';

export class GoogleIntegrationService {
  private auth: any;

  constructor(credentials: any) {
    this.auth = new google.auth.GoogleAuth({
      credentials,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/drive',
      ],
    });
  }

  // Sheets Operations
  async readSheet(spreadsheetId: string, range: string) {
    const sheets = google.sheets({ version: 'v4', auth: this.auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    return response.data.values || [];
  }

  async writeSheet(spreadsheetId: string, range: string, values: any[][], append = false) {
    const sheets = google.sheets({ version: 'v4', auth: this.auth });
    
    if (append) {
      return await sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values },
      });
    } else {
      return await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values },
      });
    }
  }

  async createSheet(title: string) {
    const sheets = google.sheets({ version: 'v4', auth: this.auth });
    const response = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title },
      },
    });
    return response.data.spreadsheetId;
  }

  // Gmail Operations
  async sendEmail(to: string, subject: string, body: string, cc?: string) {
    const gmail = google.gmail({ version: 'v1', auth: this.auth });
    
    let message = `To: ${to}\n`;
    if (cc) message += `Cc: ${cc}\n`;
    message += `Subject: ${subject}\n\n${body}`;

    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    return await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encodedMessage },
    });
  }

  async readEmails(query: string, maxResults = 10) {
    const gmail = google.gmail({ version: 'v1', auth: this.auth });
    
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults,
    });

    const messages = response.data.messages || [];
    const fullMessages = await Promise.all(
      messages.map(async (msg) => {
        const full = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id!,
        });
        return full.data;
      })
    );

    return fullMessages;
  }

  // Calendar Operations
  async createEvent(summary: string, startTime: string, endTime: string, description?: string, attendees?: string[]) {
    const calendar = google.calendar({ version: 'v3', auth: this.auth });
    
    const event = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary,
        description,
        start: { dateTime: startTime },
        end: { dateTime: endTime },
        attendees: attendees?.map(email => ({ email })),
      },
    });

    return event.data;
  }

  async listEvents(timeMin: string, timeMax: string, maxResults = 10) {
    const calendar = google.calendar({ version: 'v3', auth: this.auth });
    
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin,
      timeMax,
      maxResults,
      singleEvents: true,
      orderBy: 'startTime',
    });

    return response.data.items || [];
  }

  // Drive Operations
  async uploadFile(fileName: string, mimeType: string, fileContent: Buffer) {
    const drive = google.drive({ version: 'v3', auth: this.auth });
    
    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        mimeType,
      },
      media: {
        mimeType,
        body: fileContent,
      },
    });

    return response.data;
  }

  async downloadFile(fileId: string) {
    const drive = google.drive({ version: 'v3', auth: this.auth });
    
    const response = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    );

    return response.data;
  }
}