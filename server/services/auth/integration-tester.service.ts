// server/services/auth/integration-tester.service.ts
import { google } from 'googleapis';
import { integrationStorageService, tokenRefreshService } from './oauth.service.js';

export class IntegrationTester {
  // ============================================
  // GOOGLE SHEETS TESTER
  // ============================================

  async testGoogleSheets(userId: string, spreadsheetId: string) {
    try {
      const credentials = await tokenRefreshService.getValidGoogleCredentials(userId);

      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials(credentials);

      const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

      // Try to read the first sheet
      const response = await sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'sheets(properties(title))',
      });

      const sheetName = response.data.sheets?.[0]?.properties?.title;

      // Try to read first row
      const values = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A1:Z1`,
      });

      return {
        success: true,
        message: 'Successfully connected to Google Sheets',
        data: {
          spreadsheetId,
          sheetName,
          headers: values.data.values?.[0] || [],
        },
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Google Sheets test failed: ${error.message}`,
        error: error.message,
      };
    }
  }

  // ============================================
  // GMAIL TESTER
  // ============================================

  async testGmail(userId: string, testEmail?: string) {
    try {
      const credentials = await tokenRefreshService.getValidGoogleCredentials(userId);

      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials(credentials);

      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      // Get user profile
      const profile = await gmail.users.getProfile({ userId: 'me' });

      // If test email provided, send a test message
      if (testEmail) {
        const message = [
          `To: ${testEmail}`,
          'Subject: Gmail Integration Test',
          '',
          '✅ Your Gmail integration is working correctly!',
          '',
          'This is an automated test message from your Workflow Automation system.',
        ].join('\n');

        const encodedMessage = Buffer.from(message)
          .toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_');

        await gmail.users.messages.send({
          userId: 'me',
          requestBody: { raw: encodedMessage },
        });

        return {
          success: true,
          message: `Test email sent to ${testEmail}`,
          data: {
            emailAddress: profile.data.emailAddress,
            messagesTotal: profile.data.messagesTotal,
          },
        };
      }

      return {
        success: true,
        message: 'Gmail connection verified',
        data: {
          emailAddress: profile.data.emailAddress,
          messagesTotal: profile.data.messagesTotal,
          threadsTotal: profile.data.threadsTotal,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Gmail test failed: ${error.message}`,
        error: error.message,
      };
    }
  }

  // ============================================
  // GOOGLE CALENDAR TESTER
  // ============================================

  async testGoogleCalendar(userId: string) {
    try {
      const credentials = await tokenRefreshService.getValidGoogleCredentials(userId);

      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials(credentials);

      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      // List calendars
      const response = await calendar.calendarList.list();

      const calendars = response.data.items?.map(cal => ({
        id: cal.id,
        summary: cal.summary,
        primary: cal.primary,
      }));

      return {
        success: true,
        message: 'Google Calendar connection verified',
        data: {
          calendarsCount: calendars?.length || 0,
          calendars: calendars?.slice(0, 5), // First 5 calendars
        },
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Google Calendar test failed: ${error.message}`,
        error: error.message,
      };
    }
  }

  // ============================================
  // SLACK TESTER
  // ============================================

  async testSlack(userId: string, channelId?: string) {
    try {
      const integration = await integrationStorageService.getIntegration(
        userId,
        'slack'
      );

      if (!integration) {
        throw new Error('Slack integration not found');
      }

      const { access_token } = integration.credentials;

      // Test auth
      const authResponse = await fetch('https://slack.com/api/auth.test', {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      });

      const authData = await authResponse.json();

      if (!authData.ok) {
        throw new Error(authData.error);
      }

      // List channels
      const channelsResponse = await fetch(
        'https://slack.com/api/conversations.list',
        {
          headers: {
            Authorization: `Bearer ${access_token}`,
          },
        }
      );

      const channelsData = await channelsResponse.json();

      // If channel ID provided, send test message
      if (channelId) {
        const messageResponse = await fetch(
          'https://slack.com/api/chat.postMessage',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              channel: channelId,
              text: '✅ Slack integration test successful!',
            }),
          }
        );

        const messageData = await messageResponse.json();

        if (!messageData.ok) {
          throw new Error(messageData.error);
        }

        return {
          success: true,
          message: 'Test message sent to Slack channel',
          data: {
            team: authData.team,
            user: authData.user,
            channelsCount: channelsData.channels?.length || 0,
          },
        };
      }

      return {
        success: true,
        message: 'Slack connection verified',
        data: {
          team: authData.team,
          user: authData.user,
          channelsCount: channelsData.channels?.length || 0,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Slack test failed: ${error.message}`,
        error: error.message,
      };
    }
  }

  // ============================================
  // NOTION TESTER
  // ============================================

  async testNotion(userId: string) {
    try {
      const integration = await integrationStorageService.getIntegration(
        userId,
        'notion'
      );

      if (!integration) {
        throw new Error('Notion integration not found');
      }

      const { access_token } = integration.credentials;

      // Search for databases
      const response = await fetch('https://api.notion.com/v1/search', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${access_token}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filter: {
            property: 'object',
            value: 'database',
          },
        }),
      });

      const data = await response.json();

      const databases = data.results?.map((db: any) => ({
        id: db.id,
        title: db.title?.[0]?.plain_text || 'Untitled',
      }));

      return {
        success: true,
        message: 'Notion connection verified',
        data: {
          databasesCount: databases?.length || 0,
          databases: databases?.slice(0, 5),
        },
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Notion test failed: ${error.message}`,
        error: error.message,
      };
    }
  }

  // ============================================
  // COMPREHENSIVE INTEGRATION TEST
  // ============================================

  async testAllIntegrations(userId: string) {
    const results = {
      google: null as any,
      slack: null as any,
      notion: null as any,
      overall: {
        totalIntegrations: 0,
        successfulIntegrations: 0,
        failedIntegrations: 0,
      },
    };

    // Test Google
    try {
      const googleIntegration = await integrationStorageService.getIntegration(
        userId,
        'google'
      );

      if (googleIntegration) {
        results.overall.totalIntegrations++;
        const sheetsTest = await this.testGoogleSheets(
          userId,
          'test-spreadsheet-id'
        );
        const gmailTest = await this.testGmail(userId);
        const calendarTest = await this.testGoogleCalendar(userId);

        results.google = {
          connected: true,
          sheets: sheetsTest.success,
          gmail: gmailTest.success,
          calendar: calendarTest.success,
        };

        if (sheetsTest.success && gmailTest.success && calendarTest.success) {
          results.overall.successfulIntegrations++;
        } else {
          results.overall.failedIntegrations++;
        }
      }
    } catch (error) {
      results.google = { connected: false, error: 'Not connected' };
    }

    // Test Slack
    try {
      const slackIntegration = await integrationStorageService.getIntegration(
        userId,
        'slack'
      );

      if (slackIntegration) {
        results.overall.totalIntegrations++;
        const slackTest = await this.testSlack(userId);

        results.slack = {
          connected: true,
          working: slackTest.success,
          data: slackTest.data,
        };

        if (slackTest.success) {
          results.overall.successfulIntegrations++;
        } else {
          results.overall.failedIntegrations++;
        }
      }
    } catch (error) {
      results.slack = { connected: false, error: 'Not connected' };
    }

    // Test Notion
    try {
      const notionIntegration = await integrationStorageService.getIntegration(
        userId,
        'notion'
      );

      if (notionIntegration) {
        results.overall.totalIntegrations++;
        const notionTest = await this.testNotion(userId);

        results.notion = {
          connected: true,
          working: notionTest.success,
          data: notionTest.data,
        };

        if (notionTest.success) {
          results.overall.successfulIntegrations++;
        } else {
          results.overall.failedIntegrations++;
        }
      }
    } catch (error) {
      results.notion = { connected: false, error: 'Not connected' };
    }

    return results;
  }
}

export const integrationTester = new IntegrationTester();