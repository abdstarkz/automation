// server/routes/webhook.routes.ts - CLEAN VERSION (no cron-parser)
import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { User } from '@prisma/client';

const router = express.Router();
router.use(express.json());
const prisma = new PrismaClient();

// Lazy load queue to avoid circular dependency
let workflowQueue: any = null;

const getQueue = async () => {
  if (!workflowQueue) {
    const Queue = (await import('bull')).default;
    workflowQueue = new Queue('workflow-execution', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
    });
  }
  return workflowQueue;
};

// Meta Webhook Verification
router.get('/meta', (req: Request, res: Response) => {
  const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN;

  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('Webhook verified!');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
});

// Meta Webhook Event Listener
router.post('/meta', (req: Request, res: Response) => {
  const body = req.body;

  console.log('Webhook event received:', JSON.stringify(body, null, 2));

  // Process the webhook event here
  // For example, you might want to check the object and entry fields
  if (body.object === 'instagram') {
    body.entry.forEach((entry: any) => {
      entry.changes.forEach((change: any) => {
        console.log('Instagram change:', change.field, change.value);
        // Handle specific Instagram changes, e.g., new media, comments
      });
    });
  }

  res.status(200).send('EVENT_RECEIVED');
});

// Receive webhook by short URL
router.post('/:webhookUrl', async (req, res) => {
  try {
    const { webhookUrl } = req.params;
    const payload = {
      method: req.method,
      headers: req.headers,
      body: req.body,
      query: req.query,
    };

    const webhook = await prisma.webhook.findUnique({
      where: { url: webhookUrl },
    });

    if (!webhook || !webhook.isActive) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    // Optional secret verification
    if (webhook.secret) {
      const signature = req.headers['x-webhook-signature'] as string;
      if (!signature) {
        return res.status(401).json({ error: 'Signature missing' });
      }

      // Reconstruct the payload to verify the signature
      const hmac = crypto.createHmac('sha256', webhook.secret);
      hmac.update(req.body); // Use raw body for HMAC calculation
      const digest = hmac.digest('hex');

      // Use timingSafeEqual to prevent timing attacks
      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))) {
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    await prisma.webhookRequest.create({
      data: {
        id: `req-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        webhookId: webhook.id,
        method: req.method,
        headers: req.headers as any,
        body: req.body,
        query: req.query as any,
        status: 'received',
      },
    });

    const queue = await getQueue();
    await queue.add('webhook', {
      webhookId: webhook.id,
      payload,
    });

    res.json({ success: true, message: 'Webhook received' });
  } catch (error: any) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

// Create webhook
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { workflowId, name, secret } = req.body;

    const webhookUrl = `wh-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    const webhook = await prisma.webhook.create({
      data: {
        id: `webhook-${Date.now()}`,
        userId: user.id,
        workflowId,
        name,
        url: webhookUrl,
        secret,
        isActive: true,
      },
    });

    res.status(201).json({
      webhook,
      fullUrl: `${
        process.env.API_URL || 'http://localhost:3000'
      }/api/webhooks/${webhookUrl}`,
    });
  } catch (error: any) {
    console.error('Create webhook error:', error);
    res.status(500).json({ error: 'Failed to create webhook' });
  }
});

// Get webhook + recent requests
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;

    const webhook = await prisma.webhook.findUnique({
      where: { id, userId: user.id },
      include: {
        workflow: true,
        requests: {
          take: 20,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    res.json({ webhook });
  } catch (error: any) {
    console.error('Get webhook error:', error);
    res.status(500).json({ error: 'Failed to fetch webhook' });
  }
});

export default router;
