// server/services/auth/oauth.service.ts
import { google } from 'googleapis';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/* ============================================================================
 * ENCRYPTION UTILITIES
 * ==========================================================================*/

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
  throw new Error(
    'ENCRYPTION_KEY must be set in .env and be 64 hex characters (32 bytes). ' +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
  );
}

const ALGORITHM = 'aes-256-cbc';

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY as string, 'hex'),
    iv
  );
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export function decrypt(text: string): string {
  const [ivHex, encryptedText] = text.split(':');
  const iv = Buffer.from(ivHex, 'hex');

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY as string, 'hex'),
    iv
  );
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/* ============================================================================
 * GOOGLE OAUTH SERVICE
 * ==========================================================================*/

export class GoogleOAuthService {
  private oauth2Client: any;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_CALLBACK_URL || process.env.GOOGLE_REDIRECT_URI
    );
  }

  getAuthUrl(state: string): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/documents',
      ],
      state,
      prompt: 'consent',
    });
  }

  async getTokens(code: string) {
    const { tokens } = await this.oauth2Client.getToken(code);
    return tokens;
  }

  async refreshAccessToken(refreshToken: string) {
    try {
      this.oauth2Client.setCredentials({ refresh_token: refreshToken });
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      return credentials;
    } catch (error) {
      console.error('Failed to refresh Google access token:', error);
      throw new Error('Failed to refresh Google access token. Please re-authenticate.');
    }
  }

  getAuthorizedClient(credentials: any) {
    const client = new google.auth.OAuth2();
    client.setCredentials(credentials);
    return client;
  }

  async getUserInfo(accessToken: string) {
    this.oauth2Client.setCredentials({ access_token: accessToken });

    const oauth2 = google.oauth2({
      version: 'v2',
      auth: this.oauth2Client,
    });

    const { data } = await oauth2.userinfo.get();

    if (!data.verified_email) {
      throw new Error('Google account email not verified.');
    }

    return {
      email: data.email,
      name: data.name,
      picture: data.picture,
    };
  }
}

/* ============================================================================
 * SLACK OAUTH SERVICE
 * ==========================================================================*/

export class SlackOAuthService {
  getAuthUrl(state: string): string {
    const scopes = [
      'chat:write',
      'channels:read',
      'channels:manage',
      'users:read',
      'groups:read',
      'im:read',
      'mpim:read',
    ];

    return `https://slack.com/oauth/v2/authorize?client_id=${
      process.env.SLACK_CLIENT_ID
    }&scope=${scopes.join(',')}&state=${state}&redirect_uri=${
      process.env.SLACK_REDIRECT_URI
    }`;
  }

  async getTokens(code: string) {
    const response = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.SLACK_CLIENT_ID || '',
        client_secret: process.env.SLACK_CLIENT_SECRET || '',
        code,
        redirect_uri: process.env.SLACK_REDIRECT_URI || '',
      }),
    });

    const data: any = await response.json();

    if (!data.ok) {
      throw new Error(data.error || 'Slack OAuth failed');
    }

    return {
      access_token: data.access_token,
      team_id: data.team.id,
      team_name: data.team.name,
      bot_user_id: data.bot_user_id,
      scope: data.scope,
    };
  }

  async getUserInfo(accessToken: string) {
    const response = await fetch('https://slack.com/api/auth.test', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data: any = await response.json();
    return {
      user_id: data.user_id,
      team: data.team,
      user: data.user,
    };
  }
}

/* ============================================================================
 * TWITTER OAUTH SERVICE (OAuth 2.0)
 * ==========================================================================*/

export class TwitterOAuthService {
  getAuthUrl(state: string): string {
    return `https://twitter.com/i/oauth2/authorize?client_id=${
      process.env.TWITTER_CLIENT_ID
    }&response_type=code&redirect_uri=${
      process.env.TWITTER_REDIRECT_URI
    }&scope=tweet.read%20tweet.write%20users.read%20offline.access&state=${state}&code_challenge=challenge&code_challenge_method=plain`;
    // NOTE: for production use PKCE properly; this is simplified.
  }

  async getTokens(code: string) {
    const response = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(
          `${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`
        ).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.TWITTER_REDIRECT_URI || '',
        code_verifier: 'challenge', // must match code_challenge (PKCE)
      }),
    });

    const data: any = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Twitter OAuth failed');
    }

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      scope: data.scope,
      expires_in: data.expires_in,
      token_type: data.token_type,
    };
  }

  async getUserInfo(accessToken: string) {
    const response = await fetch('https://api.twitter.com/2/users/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data: any = await response.json();
    return data.data;
  }
}

/* ============================================================================
 * LINKEDIN OAUTH SERVICE
 * ==========================================================================*/

export class LinkedInOAuthService {
  getAuthUrl(state: string): string {
    const scopes = ['r_liteprofile', 'r_emailaddress', 'w_member_social'];

    return `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${
      process.env.LINKEDIN_CLIENT_ID
    }&redirect_uri=${encodeURIComponent(
      process.env.LINKEDIN_REDIRECT_URI || ''
    )}&scope=${encodeURIComponent(scopes.join(' '))}&state=${state}`;
  }

  async getTokens(code: string) {
    const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.LINKEDIN_REDIRECT_URI || '',
        client_id: process.env.LINKEDIN_CLIENT_ID || '',
        client_secret: process.env.LINKEDIN_CLIENT_SECRET || '',
      }),
    });

    const data: any = await response.json();
    if (!response.ok) {
      throw new Error(data.error_description || 'LinkedIn OAuth failed');
    }

    return {
      access_token: data.access_token,
      expires_in: data.expires_in,
    };
  }

  async getUserInfo(accessToken: string) {
    const profileRes = await fetch('https://api.linkedin.com/v2/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const emailRes = await fetch(
      'https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const profile: any = await profileRes.json();
    const emailData: any = await emailRes.json();
    const email = emailData.elements?.[0]?.['handle~']?.emailAddress;

    return {
      id: profile.id,
      firstName: profile.localizedFirstName,
      lastName: profile.localizedLastName,
      email,
    };
  }
}

/* ============================================================================
 * SPOTIFY OAUTH SERVICE
 * ==========================================================================*/

export class SpotifyOAuthService {
  getAuthUrl(state: string): string {
    const scopes = [
      'playlist-modify-public',
      'playlist-modify-private',
      'user-read-email',
      'user-read-private',
    ];

    return `https://accounts.spotify.com/authorize?response_type=code&client_id=${
      process.env.SPOTIFY_CLIENT_ID
    }&redirect_uri=${encodeURIComponent(
      process.env.SPOTIFY_REDIRECT_URI || ''
    )}&scope=${encodeURIComponent(scopes.join(' '))}&state=${state}`;
  }

  async getTokens(code: string) {
    const authHeader =
      'Basic ' +
      Buffer.from(
        `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
      ).toString('base64');

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI || '',
      }),
    });

    const data: any = await response.json();
    if (!response.ok) {
      throw new Error(data.error_description || 'Spotify OAuth failed');
    }

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      scope: data.scope,
      expires_in: data.expires_in,
      token_type: data.token_type,
    };
  }

  async refreshToken(refreshToken: string) {
    const authHeader =
      'Basic ' +
      Buffer.from(
        `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
      ).toString('base64');

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    const data: any = await response.json();
    if (!response.ok) {
      throw new Error(data.error_description || 'Spotify token refresh failed');
    }

    return data;
  }

  async getUserInfo(accessToken: string) {
    const response = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data: any = await response.json();
    return data;
  }
}

/* ============================================================================
 * GITHUB OAUTH SERVICE
 * ==========================================================================*/

export class GitHubOAuthService {
  getAuthUrl(state: string): string {
    const scopes = ['repo', 'user', 'workflow'];

    return `https://github.com/login/oauth/authorize?client_id=${
      process.env.GITHUB_CLIENT_ID
    }&redirect_uri=${encodeURIComponent(
      process.env.GITHUB_REDIRECT_URI || ''
    )}&scope=${encodeURIComponent(scopes.join(' '))}&state=${state}`;
  }

  async getTokens(code: string) {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.GITHUB_CLIENT_ID || '',
        client_secret: process.env.GITHUB_CLIENT_SECRET || '',
        code,
        redirect_uri: process.env.GITHUB_REDIRECT_URI || '',
      }),
    });

    const data: any = await response.json();
    if (!response.ok) {
      throw new Error(data.error_description || 'GitHub OAuth failed');
    }

    return {
      access_token: data.access_token,
      scope: data.scope,
      token_type: data.token_type,
    };
  }

  async getUserInfo(accessToken: string) {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'workflow-automation-app',
      },
    });

    const data: any = await response.json();
    return data;
  }
}

/* ============================================================================
 * META (FACEBOOK / INSTAGRAM) OAUTH SERVICE
 * ==========================================================================*/

export class MetaOAuthService {
  getAuthUrl(state: string): string {
    const scopes = [
      'public_profile',
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_posts',
      'instagram_basic',
      'instagram_content_publish',
    ];

    return `https://www.facebook.com/v18.0/dialog/oauth?client_id=${
      process.env.META_CLIENT_ID
    }&redirect_uri=${encodeURIComponent(
      process.env.META_REDIRECT_URI || ''
    )}&state=${state}&scope=${encodeURIComponent(scopes.join(','))}`;
  }

  async getTokens(code: string) {
    const url = new URL('https://graph.facebook.com/v18.0/oauth/access_token');
    url.searchParams.set('client_id', process.env.META_CLIENT_ID || '');
    url.searchParams.set('client_secret', process.env.META_CLIENT_SECRET || '');
    url.searchParams.set('redirect_uri', process.env.META_REDIRECT_URI || '');
    url.searchParams.set('code', code);

    const response = await fetch(url.toString(), {
      method: 'GET',
    });

    const data: any = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || 'Meta OAuth failed');
    }

    return {
      access_token: data.access_token,
      token_type: data.token_type,
      expires_in: data.expires_in,
    };
  }

  async getUserInfo(accessToken: string) {
    const response = await fetch(
      'https://graph.facebook.com/me?fields=id,name,picture',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const data: any = await response.json();
    return data;
  }
}

/* ============================================================================
 * NOTION OAUTH SERVICE
 * ==========================================================================*/

export class NotionOAuthService {
  getAuthUrl(state: string): string {
    return `https://api.notion.com/v1/oauth/authorize?client_id=${
      process.env.NOTION_CLIENT_ID
    }&response_type=code&owner=user&state=${state}&redirect_uri=${
      process.env.NOTION_REDIRECT_URI
    }`;
  }

  async getTokens(code: string) {
    const auth = Buffer.from(
      `${process.env.NOTION_CLIENT_ID}:${process.env.NOTION_CLIENT_SECRET}`
    ).toString('base64');

    const response = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.NOTION_REDIRECT_URI,
      }),
    });

    const data: any = await response.json();

    if (!data.access_token) {
      throw new Error('No Notion access token received');
    }

    return {
      access_token: data.access_token,
      workspace_id: data.workspace_id,
      workspace_name: data.workspace_name,
      workspace_icon: data.workspace_icon,
      bot_id: data.bot_id,
      owner: data.owner,
    };
  }
}

/* ============================================================================
 * INTEGRATION STORAGE SERVICE (Prisma)
 * ==========================================================================*/

export class IntegrationStorageService {
  async saveIntegration(userId: string, type: string, name: string, credentials: any) {
    const encryptedCredentials = encrypt(JSON.stringify(credentials));

    return prisma.integration.upsert({
      where: {
        userId_type_name: {
          userId,
          type,
          name,
        },
      },
      update: {
        credentials: encryptedCredentials,
        isActive: true,
        updatedAt: new Date(),
      },
      create: {
        userId,
        type,
        name,
        credentials: encryptedCredentials,
        isActive: true,
      },
    });
  }

  async getIntegration(userId: string, typeOrId: string) {
    let integration = await prisma.integration.findFirst({
      where: {
        userId,
        type: typeOrId,
        isActive: true,
      },
    });

    if (!integration) {
      integration = await prisma.integration.findFirst({
        where: {
          id: typeOrId,
          userId,
        },
      });
    }

    if (!integration) return null;

    const credentials = JSON.parse(decrypt(integration.credentials));

    return {
      id: integration.id,
      type: integration.type,
      name: integration.name,
      credentials,
      isActive: integration.isActive,
      createdAt: integration.createdAt,
      updatedAt: integration.updatedAt,
    };
  }

  async listIntegrations(userId: string) {
    return prisma.integration.findMany({
      where: { userId },
      select: {
        id: true,
        type: true,
        name: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteIntegration(userId: string, integrationId: string) {
    return prisma.integration.deleteMany({
      where: {
        id: integrationId,
        userId,
      },
    });
  }

  async updateIntegrationStatus(
    integrationId: string,
    userId: string,
    isActive: boolean
  ) {
    return prisma.integration.updateMany({
      where: {
        id: integrationId,
        userId,
      },
      data: {
        isActive,
        updatedAt: new Date(),
      },
    });
  }
}

/* ============================================================================
 * TOKEN REFRESH SERVICE (Google)
 * ==========================================================================*/

export class TokenRefreshService {
  private googleService: GoogleOAuthService;
  private storageService: IntegrationStorageService;

  constructor() {
    this.googleService = new GoogleOAuthService();
    this.storageService = new IntegrationStorageService();
  }

  async refreshGoogleToken(userId: string) {
    const integration = await this.storageService.getIntegration(userId, 'google');

    if (!integration) {
      throw new Error('Google integration not found');
    }

    const { refresh_token, expiry_date } = integration.credentials;

    if (!refresh_token) {
      throw new Error('No refresh token available for Google integration');
    }

    const now = Date.now();
    const expiresAt = expiry_date || 0;

    // If token still valid for more than 5 minutes, keep current
    if (expiresAt && now < expiresAt - 5 * 60 * 1000) {
      return integration.credentials;
    }

    try {
      const newCredentials = await this.googleService.refreshAccessToken(refresh_token);

      const merged = {
        ...integration.credentials,
        access_token: newCredentials.access_token,
        expiry_date: newCredentials.expiry_date,
      };

      await this.storageService.saveIntegration(userId, 'google', integration.name, merged);

      return merged;
    } catch (error) {
      console.error('Failed to refresh Google access token, invalidating integration:', error);
      await this.storageService.deleteIntegration(userId, 'google');
      throw new Error('Failed to refresh Google access token. Please re-authenticate.');
    }
  }

  async getValidGoogleCredentials(userId: string) {
    try {
      return await this.refreshGoogleToken(userId);
    } catch (error) {
      console.error('Error refreshing Google token:', error);
      throw new Error(
        'Failed to get valid Google credentials. Please reconnect your Google account.'
      );
    }
  }
}

/* ============================================================================
 * WEBHOOK VALIDATION SERVICE (Discord / Telegram / Slack)
 * ==========================================================================*/

export class WebhookValidationService {
  async validateDiscordWebhook(webhookUrl: string): Promise<boolean> {
    try {
      // 1. Validate URL format
      const discordWebhookRegex = /^https:\/\/discord\.com\/api\/webhooks\/\d+\/[a-zA-Z0-9_-]+$/;
      if (!discordWebhookRegex.test(webhookUrl)) {
        console.warn('Invalid Discord webhook URL format', webhookUrl);
        return false;
      }

      // 2. Perform a GET request to verify legitimacy and activity
      const response = await fetch(webhookUrl, {
        method: 'GET',
      });

      if (!response.ok) {
        console.warn(
          `Discord webhook GET request failed with status ${response.status}`,
          webhookUrl
        );
        return false;
      }

      const data = await response.json();

      // Check for essential webhook properties
      if (!data.id || !data.name || !data.channel_id) {
        console.warn('Discord webhook GET response missing essential properties', data);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error validating Discord webhook:', error);
      return false;
    }
  }

  async validateTelegramBot(botToken: string, chatId: string): Promise<boolean> {
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: '✅ Bot validation test',
          }),
        }
      );

      const data: any = await response.json();
      return data.ok;
    } catch {
      return false;
    }
  }

  async validateSlackWebhook(webhookUrl: string): Promise<boolean> {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: '✅ Webhook validation test',
        }),
      });

      return response.ok;
    } catch {
      return false;
    }
  }
}

/* ============================================================================
 * OAUTH STATE SERVICE (CSRF Protection)
 * ==========================================================================*/

export class OAuthStateService {
  generateState(userId: string, type: string): string {
    const data = {
      userId,
      type,
      timestamp: Date.now(),
      nonce: crypto.randomBytes(16).toString('hex'),
    };

    return Buffer.from(JSON.stringify(data)).toString('base64url');
  }

  validateState(state: string, maxAge = 10 * 60 * 1000): any {
    try {
      const decoded = JSON.parse(
        Buffer.from(state, 'base64url').toString('utf8')
      );

      if (Date.now() - decoded.timestamp > maxAge) {
        throw new Error('State expired');
      }

      return decoded;
    } catch (_error) {
      throw new Error('Invalid state parameter');
    }
  }
}

/* ============================================================================
 * SINGLETON EXPORTS
 * ==========================================================================*/

export const googleOAuthService = new GoogleOAuthService();
export const slackOAuthService = new SlackOAuthService();
export const twitterOAuthService = new TwitterOAuthService();
export const linkedinOAuthService = new LinkedInOAuthService();
export const spotifyOAuthService = new SpotifyOAuthService();
export const githubOAuthService = new GitHubOAuthService();
export const metaOAuthService = new MetaOAuthService();
export const notionOAuthService = new NotionOAuthService();
export const integrationStorageService = new IntegrationStorageService();
export const tokenRefreshService = new TokenRefreshService();
export const webhookValidationService = new WebhookValidationService();
export const oauthStateService = new OAuthStateService();

/* ============================================================================
 * HELPER FOR OTHER SERVICES
 * ==========================================================================*/

export async function getIntegrationCredentials(userId: string, type: string) {
  const integration = await integrationStorageService.getIntegration(userId, type);

  if (!integration) {
    throw new Error(`No active ${type} integration found for user`);
  }

  if (type === 'google') {
    return tokenRefreshService.getValidGoogleCredentials(userId);
  }

  return integration.credentials;
}
