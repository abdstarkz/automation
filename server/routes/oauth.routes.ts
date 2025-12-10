// server/routes/oauth.routes.ts
import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import {
  googleOAuthService,
  slackOAuthService,
  notionOAuthService,
  integrationStorageService,
  tokenRefreshService,
  oauthStateService,
  webhookValidationService,
} from '../services/auth/oauth.service.js';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { redis } from '../lib/redis.js';

const prisma = new PrismaClient();
const router = Router();

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// ============================================================================
// HELPER: Get OAuth URL endpoints (called by frontend)
// ============================================================================

router.get('/google/url', authenticateToken, (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const state = oauthStateService.generateState(user.id, 'google');
    const authUrl = googleOAuthService.getAuthUrl(state);
    res.json({ url: authUrl });
  } catch (error: any) {
    console.error('Google URL error:', error);
    res.status(500).json({ error: 'Failed to generate Google auth URL' });
  }
});

router.get('/slack/url', authenticateToken, (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const state = oauthStateService.generateState(user.id, 'slack');
    const authUrl = slackOAuthService.getAuthUrl(state);
    res.json({ url: authUrl });
  } catch (error: any) {
    console.error('Slack URL error:', error);
    res.status(500).json({ error: 'Failed to generate Slack auth URL' });
  }
});

router.get('/notion/url', authenticateToken, (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const state = oauthStateService.generateState(user.id, 'notion');
    const authUrl = notionOAuthService.getAuthUrl(state);
    res.json({ url: authUrl });
  } catch (error: any) {
    console.error('Notion URL error:', error);
    res.status(500).json({ error: 'Failed to generate Notion auth URL' });
  }
});

router.get('/twitter/url', authenticateToken, (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const state = oauthStateService.generateState(user.id, 'twitter');
    const authUrl = `https://twitter.com/i/oauth2/authorize?client_id=${
      process.env.TWITTER_CLIENT_ID
    }&response_type=code&redirect_uri=${encodeURIComponent(
      process.env.TWITTER_REDIRECT_URI || ''
    )}&scope=tweet.read%20tweet.write%20users.read&state=${state}`;
    res.json({ url: authUrl });
  } catch (error: any) {
    console.error('Twitter URL error:', error);
    res.status(500).json({ error: 'Failed to generate Twitter auth URL' });
  }
});

router.get('/linkedin/url', authenticateToken, (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const state = oauthStateService.generateState(user.id, 'linkedin');
    const scopes = 'r_liteprofile r_emailaddress w_member_social';
    const authUrl = `https://www.linkedin.com/oauth/v2/authorization?client_id=${
      process.env.LINKEDIN_CLIENT_ID
    }&response_type=code&redirect_uri=${encodeURIComponent(
      process.env.LINKEDIN_REDIRECT_URI || ''
    )}&scope=${scopes}&state=${state}`;
    res.json({ url: authUrl });
  } catch (error: any) {
    console.error('LinkedIn URL error:', error);
    res.status(500).json({ error: 'Failed to generate LinkedIn auth URL' });
  }
});

router.get('/github/url', authenticateToken, (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const state = oauthStateService.generateState(user.id, 'github');
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${
      process.env.GITHUB_CLIENT_ID
    }&redirect_uri=${encodeURIComponent(
      process.env.GITHUB_REDIRECT_URI || ''
    )}&scope=repo%20read:user&state=${state}`;
    res.json({ url: authUrl });
  } catch (error: any) {
    console.error('GitHub URL error:', error);
    res.status(500).json({ error: 'Failed to generate GitHub auth URL' });
  }
});

router.get('/spotify/url', authenticateToken, (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const state = oauthStateService.generateState(user.id, 'spotify');
    const scopes =
      'user-read-private user-read-email playlist-modify-public playlist-modify-private';
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${
      process.env.SPOTIFY_CLIENT_ID
    }&response_type=code&redirect_uri=${encodeURIComponent(
      process.env.SPOTIFY_REDIRECT_URI || ''
    )}&scope=${encodeURIComponent(scopes)}&state=${state}`;
    res.json({ url: authUrl });
  } catch (error: any) {
    console.error('Spotify URL error:', error);
    res.status(500).json({ error: 'Failed to generate Spotify auth URL' });
  }
});

router.get('/meta/url', authenticateToken, (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const state = oauthStateService.generateState(user.id, 'meta');
    const scopes =
      'pages_manage_posts,pages_read_engagement,instagram_basic,instagram_content_publish';
    const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${
      process.env.META_APP_ID
    }&redirect_uri=${encodeURIComponent(
      process.env.META_REDIRECT_URI || ''
    )}&scope=${scopes}&state=${state}`;
    res.json({ url: authUrl });
  } catch (error: any) {
    console.error('Meta URL error:', error);
    res.status(500).json({ error: 'Failed to generate Meta auth URL' });
  }
});

// ============================================================================
// GOOGLE OAUTH FLOW
// ============================================================================

router.get('/google/connect', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const stateToken = crypto.randomBytes(32).toString('hex');
    
    await redis.setex(`oauth_state:${stateToken}`, 600, user.id);
    
    const authUrl = googleOAuthService.getAuthUrl(stateToken);
    res.redirect(authUrl);
  } catch (error: any) {
    console.error('Google connect error:', error);
    res.redirect(`${CLIENT_URL}/integrations?error=connection_failed`);
  }
});

router.get('/google/callback', async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;
    if (!code || !state) {
      return res.redirect(`${CLIENT_URL}/integrations?error=missing_params`);
    }

    const userId = await redis.get(`oauth_state:${state}`);
    await redis.del(`oauth_state:${state}`);
    
    if (!userId) {
      return res.redirect(`${CLIENT_URL}/integrations?error=invalid_state`);
    }

    const tokens = await googleOAuthService.getTokens(code as string);
    if (!tokens.access_token) {
      throw new Error('No Google access token received');
    }

    const userInfo = await googleOAuthService.getUserInfo(tokens.access_token);
    
    const dbUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!dbUser || dbUser.email !== userInfo.email) {
      return res.redirect(
        `${CLIENT_URL}/integrations?error=email_mismatch&message=${encodeURIComponent(
          'Google account email must match your logged-in account'
        )}`
      );
    }

    await integrationStorageService.saveIntegration(
      userId,
      'google',
      userInfo.email || 'Google Workspace',
      {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expiry_date,
        scope: tokens.scope,
        user_email: userInfo.email,
      }
    );

    res.redirect(`${CLIENT_URL}/integrations?success=google_connected`);
  } catch (error: any) {
    console.error('Google OAuth callback error:', error);
    res.redirect(
      `${CLIENT_URL}/integrations?error=oauth_failed&message=${encodeURIComponent(error.message)}`
    );
  }
});

// ============================================================================
// SLACK OAUTH FLOW
// ============================================================================

router.get('/slack/connect', authenticateToken, (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const state = oauthStateService.generateState(user.id, 'slack');
    const authUrl = slackOAuthService.getAuthUrl(state);
    res.redirect(authUrl);
  } catch (error: any) {
    console.error('Slack connect error:', error);
    res.redirect(`${CLIENT_URL}/integrations?error=connection_failed`);
  }
});

router.get('/slack/callback', async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;

    if (!code || !state) {
      return res.redirect(`${CLIENT_URL}/integrations?error=missing_params`);
    }

    const stateData = oauthStateService.validateState(state as string);
    const { userId } = stateData;

    const tokens = await slackOAuthService.getTokens(code as string);

    await integrationStorageService.saveIntegration(
      userId,
      'slack',
      tokens.team_name,
      {
        access_token: tokens.access_token,
        team_id: tokens.team_id,
        team_name: tokens.team_name,
        bot_user_id: tokens.bot_user_id,
        scope: tokens.scope,
      }
    );

    res.redirect(`${CLIENT_URL}/integrations?success=slack_connected`);
  } catch (error: any) {
    console.error('Slack OAuth callback error:', error);
    res.redirect(
      `${CLIENT_URL}/integrations?error=oauth_failed&message=${encodeURIComponent(error.message)}`
    );
  }
});

// ============================================================================
// NOTION OAUTH FLOW
// ============================================================================

router.get('/notion/connect', authenticateToken, (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const state = oauthStateService.generateState(user.id, 'notion');
    const authUrl = notionOAuthService.getAuthUrl(state);
    res.redirect(authUrl);
  } catch (error: any) {
    console.error('Notion connect error:', error);
    res.redirect(`${CLIENT_URL}/integrations?error=connection_failed`);
  }
});

router.get('/notion/callback', async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;

    if (!code || !state) {
      return res.redirect(`${CLIENT_URL}/integrations?error=missing_params`);
    }

    const stateData = oauthStateService.validateState(state as string);
    const { userId } = stateData;

    const tokens = await notionOAuthService.getTokens(code as string);

    await integrationStorageService.saveIntegration(
      userId,
      'notion',
      tokens.workspace_name || 'Notion Workspace',
      {
        access_token: tokens.access_token,
        workspace_id: tokens.workspace_id,
        workspace_name: tokens.workspace_name,
        workspace_icon: tokens.workspace_icon,
        bot_id: tokens.bot_id,
        owner: tokens.owner,
      }
    );

    res.redirect(`${CLIENT_URL}/integrations?success=notion_connected`);
  } catch (error: any) {
    console.error('Notion OAuth callback error:', error);
    res.redirect(
      `${CLIENT_URL}/integrations?error=oauth_failed&message=${encodeURIComponent(error.message)}`
    );
  }
});

// ============================================================================
// TWITTER/X OAUTH FLOW
// ============================================================================

router.get('/twitter/callback', async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;
    if (!code || !state) {
      return res.redirect(`${CLIENT_URL}/integrations?error=missing_params`);
    }

    const stateData = oauthStateService.validateState(state as string);
    const { userId } = stateData;

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
        code: code as string,
        redirect_uri: process.env.TWITTER_REDIRECT_URI || '',
      }),
    });

    const data: any = await response.json();

    await integrationStorageService.saveIntegration(
      userId,
      'twitter',
      'Twitter Account',
      {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        consumer_key: process.env.TWITTER_API_KEY,
        consumer_secret: process.env.TWITTER_API_SECRET,
        scope: data.scope,
      }
    );

    res.redirect(`${CLIENT_URL}/integrations?success=twitter_connected`);
  } catch (error: any) {
    console.error('Twitter OAuth callback error:', error);
    res.redirect(`${CLIENT_URL}/integrations?error=oauth_failed`);
  }
});

// ============================================================================
// LINKEDIN OAUTH FLOW
// ============================================================================

router.get('/linkedin/callback', async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;
    if (!code || !state) {
      return res.redirect(`${CLIENT_URL}/integrations?error=missing_params`);
    }

    const stateData = oauthStateService.validateState(state as string);
    const { userId } = stateData;

    const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code as string,
        client_id: process.env.LINKEDIN_CLIENT_ID || '',
        client_secret: process.env.LINKEDIN_CLIENT_SECRET || '',
        redirect_uri: process.env.LINKEDIN_REDIRECT_URI || '',
      }),
    });

    const data: any = await response.json();

    const profileResponse = await fetch('https://api.linkedin.com/v2/me', {
      headers: {
        Authorization: `Bearer ${data.access_token}`,
      },
    });
    const profileData: any = await profileResponse.json();
    const personUrn = profileData.id;

    await integrationStorageService.saveIntegration(
      userId,
      'linkedin',
      'LinkedIn Account',
      {
        access_token: data.access_token,
        expires_in: data.expires_in,
        scope: data.scope,
        person_urn: personUrn,
      }
    );

    res.redirect(`${CLIENT_URL}/integrations?success=linkedin_connected`);
  } catch (error: any) {
    console.error('LinkedIn OAuth callback error:', error);
    res.redirect(`${CLIENT_URL}/integrations?error=oauth_failed`);
  }
});

// ============================================================================
// GITHUB OAUTH FLOW
// ============================================================================

router.get('/github/callback', async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;
    if (!code || !state) {
      return res.redirect(`${CLIENT_URL}/integrations?error=missing_params`);
    }

    const stateData = oauthStateService.validateState(state as string);
    const { userId } = stateData;

    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    const data: any = await response.json();

    await integrationStorageService.saveIntegration(
      userId,
      'github',
      'GitHub Account',
      {
        access_token: data.access_token,
        scope: data.scope,
      }
    );

    res.redirect(`${CLIENT_URL}/integrations?success=github_connected`);
  } catch (error: any) {
    console.error('GitHub OAuth callback error:', error);
    res.redirect(`${CLIENT_URL}/integrations?error=oauth_failed`);
  }
});

// ============================================================================
// SPOTIFY OAUTH FLOW
// ============================================================================

router.get('/spotify/callback', async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;
    if (!code || !state) {
      return res.redirect(`${CLIENT_URL}/integrations?error=missing_params`);
    }

    const stateData = oauthStateService.validateState(state as string);
    const { userId } = stateData;

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(
          `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
        ).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI || '',
      }),
    });

    const data: any = await response.json();

    await integrationStorageService.saveIntegration(
      userId,
      'spotify',
      'Spotify Account',
      {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
        scope: data.scope,
      }
    );

    res.redirect(`${CLIENT_URL}/integrations?success=spotify_connected`);
  } catch (error: any) {
    console.error('Spotify OAuth callback error:', error);
    res.redirect(`${CLIENT_URL}/integrations?error=oauth_failed`);
  }
});

// ============================================================================
// META (FACEBOOK/INSTAGRAM) OAUTH FLOW
// ============================================================================

router.get('/meta/callback', async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;
    if (!code || !state) {
      return res.redirect(`${CLIENT_URL}/integrations?error=missing_params`);
    }

    const stateData = oauthStateService.validateState(state as string);
    const { userId } = stateData;

    const response = await fetch(
      `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${
        process.env.META_APP_ID
      }&client_secret=${process.env.META_APP_SECRET}&redirect_uri=${
        process.env.META_REDIRECT_URI
      }&code=${code}`
    );

    const data: any = await response.json();

    await integrationStorageService.saveIntegration(
      userId,
      'meta',
      'Meta Account',
      {
        access_token: data.access_token,
        token_type: data.token_type,
        expires_in: data.expires_in,
      }
    );

    res.redirect(`${CLIENT_URL}/integrations?success=meta_connected`);
  } catch (error: any) {
    console.error('Meta OAuth callback error:', error);
    res.redirect(`${CLIENT_URL}/integrations?error=oauth_failed`);
  }
});

// ============================================================================
// JIRA (API TOKEN) - Manual Setup
// ============================================================================

router.post('/jira/connect', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const { domain, email, apiToken } = req.body;

    if (!domain || !email || !apiToken) {
      return res.status(400).json({ error: 'Domain, email, and API token are required' });
    }

    await integrationStorageService.saveIntegration(
      user.id,
      'jira',
      'Jira Workspace',
      {
        domain,
        email,
        api_token: apiToken,
      }
    );

    res.json({ success: true, message: 'Jira connected successfully' });
  } catch (error: any) {
    console.error('Jira connect error:', error);
    res.status(500).json({ error: 'Failed to connect Jira' });
  }
});

// ============================================================================
// INTEGRATION MANAGEMENT
// ============================================================================

router.get('/integrations', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const integrations = await integrationStorageService.listIntegrations(user.id);
    res.json({ integrations });
  } catch (error: any) {
    console.error('Get integrations error:', error);
    res.status(500).json({ error: 'Failed to fetch integrations' });
  }
});

router.get('/integrations/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const { id } = req.params;

    const integration = await integrationStorageService.getIntegration(user.id, id);

    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const { credentials, ...integrationData } = integration;
    res.json({ integration: integrationData });
  } catch (error: any) {
    console.error('Get integration error:', error);
    res.status(500).json({ error: 'Failed to fetch integration' });
  }
});

router.delete('/integrations/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const { id } = req.params;

    await integrationStorageService.deleteIntegration(user.id, id);
    res.json({ message: 'Integration disconnected successfully' });
  } catch (error: any) {
    console.error('Delete integration error:', error);
    res.status(500).json({ error: 'Failed to disconnect integration' });
  }
});

router.patch('/integrations/:id/status', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const { id } = req.params;
    const { isActive } = req.body;

    await integrationStorageService.updateIntegrationStatus(id, user.id, isActive);

    res.json({ message: 'Integration status updated successfully' });
  } catch (error: any) {
    console.error('Update integration status error:', error);
    res.status(500).json({ error: 'Failed to update integration status' });
  }
});

// ============================================================================
// TOKEN REFRESH
// ============================================================================

router.post('/google/refresh', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const credentials = await tokenRefreshService.getValidGoogleCredentials(user.id);

    res.json({
      message: 'Token refreshed successfully',
      expiresAt: credentials.expiry_date,
    });
  } catch (error: any) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// WEBHOOK VALIDATION
// ============================================================================

router.post('/validate/discord', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { webhookUrl } = req.body;

    if (!webhookUrl) {
      return res.status(400).json({ error: 'Webhook URL is required' });
    }

    const isValid = await webhookValidationService.validateDiscordWebhook(webhookUrl);

    if (!isValid) {
      return res.status(400).json({ error: 'Invalid Discord webhook URL' });
    }

    res.json({
      success: true,
      message: 'Discord webhook validated successfully',
    });
  } catch (error: any) {
    console.error('Discord validation error:', error);
    res.status(500).json({ error: 'Failed to validate Discord webhook' });
  }
});

router.post('/validate/telegram', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { chatId } = req.body;

    if (!chatId) {
      return res.status(400).json({ error: 'Chat ID is required' });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return res.status(500).json({ error: 'Telegram bot token not configured' });
    }

    const isValid = await webhookValidationService.validateTelegramBot(botToken, chatId);

    if (!isValid) {
      return res.status(400).json({ error: 'Invalid Telegram chat ID' });
    }

    res.json({
      success: true,
      message: 'Telegram bot validated successfully',
    });
  } catch (error: any) {
    console.error('Telegram validation error:', error);
    res.status(500).json({ error: 'Failed to validate Telegram bot' });
  }
});

router.post('/validate/slack-webhook', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { webhookUrl } = req.body;

    if (!webhookUrl) {
      return res.status(400).json({ error: 'Webhook URL is required' });
    }

    const isValid = await webhookValidationService.validateSlackWebhook(webhookUrl);

    if (!isValid) {
      return res.status(400).json({ error: 'Invalid Slack webhook URL' });
    }

    res.json({
      success: true,
      message: 'Slack webhook validated successfully',
    });
  } catch (error: any) {
    console.error('Slack validation error:', error);
    res.status(500).json({ error: 'Failed to validate Slack webhook' });
  }
});

export default router;