// server/routes/integrations.routes.ts
import { Router, Request, Response } from 'express';
import { google } from 'googleapis';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { getIntegrationCredentials } from '../services/auth/oauth.service.js';
import twilio from 'twilio';

const router = Router();

// ============================================
// GOOGLE SHEETS - List User's Spreadsheets
// ============================================

router.get('/google/sheets', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const credentials = await getIntegrationCredentials(user.id, 'google');

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: credentials.access_token,
      refresh_token: credentials.refresh_token,
    });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    const response = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.spreadsheet'",
      fields: 'files(id, name, modifiedTime)',
      pageSize: 100,
      orderBy: 'modifiedTime desc',
    });

    const sheets = response.data.files?.map(file => ({
      id: file.id,
      name: file.name,
      lastModified: file.modifiedTime,
    })) || [];

    res.json({ sheets });
  } catch (error: any) {
    console.error('Error fetching Google Sheets:', error);
    res.status(500).json({ error: 'Failed to fetch spreadsheets' });
  }
});

// Get specific spreadsheet ranges/tabs
router.get('/google/sheets/:spreadsheetId/ranges', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const { spreadsheetId } = req.params;
    const credentials = await getIntegrationCredentials(user.id, 'google');

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: credentials.access_token,
      refresh_token: credentials.refresh_token,
    });

    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
    
    const response = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets(properties(title,sheetId,gridProperties))',
    });

    const ranges = response.data.sheets?.map(sheet => ({
      title: sheet.properties?.title,
      sheetId: sheet.properties?.sheetId,
      rows: sheet.properties?.gridProperties?.rowCount,
      columns: sheet.properties?.gridProperties?.columnCount,
    })) || [];

    res.json({ ranges });
  } catch (error: any) {
    console.error('Error fetching sheet ranges:', error);
    res.status(500).json({ error: 'Failed to fetch sheet ranges' });
  }
});

// ============================================
// SLACK - List Channels
// ============================================

router.get('/slack/channels', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const credentials = await getIntegrationCredentials(user.id, 'slack');

    const response = await fetch('https://slack.com/api/conversations.list', {
      headers: {
        'Authorization': `Bearer ${credentials.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!data.ok) {
      throw new Error(data.error);
    }

    const channels = data.channels.map((channel: any) => ({
      id: channel.id,
      name: channel.name,
      isPrivate: channel.is_private,
      isMember: channel.is_member,
      memberCount: channel.num_members,
    }));

    res.json({ channels });
  } catch (error: any) {
    console.error('Error fetching Slack channels:', error);
    res.status(500).json({ error: 'Failed to fetch Slack channels' });
  }
});

// Test Slack message
router.post('/slack/test', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const { channel, text } = req.body;
    const credentials = await getIntegrationCredentials(user.id, 'slack');

    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${credentials.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel,
        text: text || '✅ Test message from Workflow Automation',
      }),
    });

    const data = await response.json();

    if (!data.ok) {
      throw new Error(data.error);
    }

    res.json({ success: true, message: 'Test message sent successfully' });
  } catch (error: any) {
    console.error('Error sending test message:', error);
    res.status(500).json({ error: 'Failed to send test message' });
  }
});

// ============================================
// NOTION - List Databases
// ============================================

router.get('/notion/databases', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const credentials = await getIntegrationCredentials(user.id, 'notion');

    const response = await fetch('https://api.notion.com/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${credentials.access_token}`,
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
      url: db.url,
      lastEdited: db.last_edited_time,
    })) || [];

    res.json({ databases });
  } catch (error: any) {
    console.error('Error fetching Notion databases:', error);
    res.status(500).json({ error: 'Failed to fetch Notion databases' });
  }
});

// ============================================
// GMAIL - List Labels
// ============================================

router.get('/google/gmail/labels', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const credentials = await getIntegrationCredentials(user.id, 'google');

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: credentials.access_token,
      refresh_token: credentials.refresh_token,
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    const response = await gmail.users.labels.list({
      userId: 'me',
    });

    const labels = response.data.labels?.map(label => ({
      id: label.id,
      name: label.name,
      type: label.type,
    })) || [];

    res.json({ labels });
  } catch (error: any) {
    console.error('Error fetching Gmail labels:', error);
    res.status(500).json({ error: 'Failed to fetch Gmail labels' });
  }
});

// Test Gmail send
router.post('/google/gmail/test', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const { to, subject } = req.body;
    const credentials = await getIntegrationCredentials(user.id, 'google');

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: credentials.access_token,
      refresh_token: credentials.refresh_token,
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    const message = [
      `To: ${to}`,
      `Subject: ${subject || 'Test Email from Workflow Automation'}`,
      '',
      '✅ This is a test email from your Workflow Automation system.',
      '',
      'If you received this, your Gmail integration is working correctly!',
    ].join('\n');

    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encodedMessage },
    });

    res.json({ success: true, message: 'Test email sent successfully' });
  } catch (error: any) {
    console.error('Error sending test email:', error);
    res.status(500).json({ error: 'Failed to send test email' });
  }
});

// ============================================
// GOOGLE CALENDAR - List Calendars
// ============================================

router.get('/google/calendars', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const credentials = await getIntegrationCredentials(user.id, 'google');

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: credentials.access_token,
      refresh_token: credentials.refresh_token,
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    const response = await calendar.calendarList.list();

    const calendars = response.data.items?.map(cal => ({
      id: cal.id,
      summary: cal.summary,
      description: cal.description,
      timeZone: cal.timeZone,
      primary: cal.primary,
    })) || [];

    res.json({ calendars });
  } catch (error: any) {
    console.error('Error fetching calendars:', error);
    res.status(500).json({ error: 'Failed to fetch calendars' });
  }
});

// ============================================
// DISCORD - Validate Webhook
// ============================================

router.post('/discord/validate', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { webhookUrl } = req.body;

    // Test webhook by sending a test message
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: '✅ Webhook validation successful! Your Discord integration is ready.',
        username: 'Workflow Automation',
      }),
    });

    if (!response.ok) {
      throw new Error('Invalid webhook URL');
    }

    res.json({ success: true, message: 'Webhook validated successfully' });
  } catch (error: any) {
    console.error('Error validating Discord webhook:', error);
    res.status(400).json({ error: 'Invalid Discord webhook URL' });
  }
});

// ============================================
// TELEGRAM - Validate Bot
// ============================================

router.post('/telegram/validate', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { chatId } = req.body;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: '✅ Telegram bot validated! Your integration is ready.',
        }),
      }
    );

    const data = await response.json();

    if (!data.ok) {
      throw new Error(data.description || 'Invalid chat ID');
    }

    res.json({ success: true, message: 'Telegram validated successfully' });
  } catch (error: any) {
    console.error('Error validating Telegram:', error);
    res.status(400).json({ error: 'Invalid Telegram chat ID' });
  }
});

router.post('/whatsapp/test', async (req, res) => {
  try {
    const { to, body } = req.body;

    if (!to || !body) {
      return res
        .status(400)
        .json({ error: 'to and body are required for WhatsApp test' });
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      return res
        .status(500)
        .json({ error: 'Twilio WhatsApp env vars not configured' });
    }

    const client = twilio(accountSid, authToken);

    await client.messages.create({
      from: fromNumber,
      to,
      body,
    });

    res.json({ success: true, message: 'WhatsApp test message sent' });
  } catch (err: any) {
    console.error('WhatsApp test error:', err);
    res.status(500).json({ error: 'Failed to send WhatsApp test message' });
  }
});
// ============================================
// TWITTER - Test Tweet
// ============================================

router.post('/twitter/test', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const { text } = req.body;
    const credentials = await getIntegrationCredentials(user.id, 'twitter');

    const OAuth = require('oauth-1.0a');
    const crypto = require('crypto');

    const oauth = OAuth({
      consumer: { 
        key: credentials.consumer_key, 
        secret: credentials.consumer_secret 
      },
      signature_method: 'HMAC-SHA1',
      hash_function(baseString: string, key: string) {
        return crypto.createHmac('sha1', key).update(baseString).digest('base64');
      },
    });

    const requestData = {
      url: 'https://api.twitter.com/2/tweets',
      method: 'POST',
    };

    const token = { 
      key: credentials.access_token, 
      secret: credentials.access_secret 
    };
    
    const headers = oauth.toHeader(oauth.authorize(requestData, token));

    const response = await fetch(requestData.url, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        text: text || '✅ Test tweet from Workflow Automation' 
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || 'Tweet failed');
    }

    res.json({ success: true, message: 'Test tweet posted successfully', tweetId: data.data?.id });
  } catch (error: any) {
    console.error('Error posting test tweet:', error);
    res.status(500).json({ error: 'Failed to post test tweet' });
  }
});

// ============================================
// LINKEDIN - Test Post
// ============================================

router.post('/linkedin/test', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const { text } = req.body;
    const credentials = await getIntegrationCredentials(user.id, 'linkedin');

    const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${credentials.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        author: 'urn:li:person:YOUR_PERSON_ID', // Need to get this from profile
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: { 
              text: text || '✅ Test post from Workflow Automation' 
            },
            shareMediaCategory: 'NONE',
          },
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Post failed');
    }

    res.json({ success: true, message: 'Test post published successfully' });
  } catch (error: any) {
    console.error('Error posting to LinkedIn:', error);
    res.status(500).json({ error: 'Failed to post to LinkedIn' });
  }
});

// ============================================
// GITHUB - List Repositories
// ============================================

router.get('/github/repos', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const credentials = await getIntegrationCredentials(user.id, 'github');

    const response = await fetch('https://api.github.com/user/repos', {
      headers: {
        'Authorization': `token ${credentials.access_token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    const data = await response.json();

    const repos = data.map((repo: any) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      private: repo.private,
      url: repo.html_url,
    }));

    res.json({ repos });
  } catch (error: any) {
    console.error('Error fetching GitHub repos:', error);
    res.status(500).json({ error: 'Failed to fetch repositories' });
  }
});

// ============================================
// JIRA - List Projects
// ============================================

router.get('/jira/projects', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const credentials = await getIntegrationCredentials(user.id, 'jira');

    const response = await fetch(`${credentials.domain}/rest/api/3/project`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(
          `${credentials.email}:${credentials.api_token}`
        ).toString('base64')}`,
        'Accept': 'application/json',
      },
    });

    const data = await response.json();

    const projects = data.map((project: any) => ({
      id: project.id,
      key: project.key,
      name: project.name,
      projectTypeKey: project.projectTypeKey,
    }));

    res.json({ projects });
  } catch (error: any) {
    console.error('Error fetching Jira projects:', error);
    res.status(500).json({ error: 'Failed to fetch Jira projects' });
  }
});

// ============================================
// SPOTIFY - List Playlists
// ============================================

router.get('/spotify/playlists', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const credentials = await getIntegrationCredentials(user.id, 'spotify');

    const response = await fetch('https://api.spotify.com/v1/me/playlists', {
      headers: {
        'Authorization': `Bearer ${credentials.access_token}`,
      },
    });

    const data = await response.json();

    const playlists = data.items?.map((playlist: any) => ({
      id: playlist.id,
      name: playlist.name,
      public: playlist.public,
      tracksTotal: playlist.tracks?.total,
      url: playlist.external_urls?.spotify,
    })) || [];

    res.json({ playlists });
  } catch (error: any) {
    console.error('Error fetching Spotify playlists:', error);
    res.status(500).json({ error: 'Failed to fetch playlists' });
  }
});

export default router;