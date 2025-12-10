import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { PrismaClient } from '@prisma/client';
import { decrypt } from '../services/auth/oauth.service.js';

const router = Router();
const prisma = new PrismaClient();

router.post('/generate-workflow', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const { prompt } = req.body; // mode: 'text' or 'voice'

    if (!prompt?.trim()) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Get user's OpenAI key
    const apiKey = await prisma.userApiKey.findFirst({
      where: { userId: user.id, service: 'openai', isActive: true },
    });

    if (!apiKey) {
      return res.status(400).json({ 
        error: 'OpenAI API key not found. Please add one in Settings > API Keys.' 
      });
    }

    const openaiKey = decrypt(apiKey.encryptedKey);

    // Call OpenAI
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: openaiKey });

    const systemPrompt = `You are a workflow automation expert. Convert user descriptions into workflow JSON.

CRITICAL: Return ONLY valid JSON, no markdown, no explanation.

Format:
{
  "name": "Workflow Name",
  "description": "Brief description",
  "nodes": [
    {
      "id": "node-1",
      "type": "custom",
      "position": {"x": 250, "y": 50},
      "data": {
        "label": "Node Label",
        "type": "trigger_manual",
        "color": "#6366f1",
        "variant": "default",
        "config": {}
      }
    }
  ],
  "edges": [
    {"id": "e1-2", "source": "node-1", "target": "node-2", "type": "smoothstep", "animated": true}
  ]
}

Available types: trigger_manual, trigger_schedule, trigger_webhook, google_sheets_read, google_sheets_write, google_gmail_send, slack_send, telegram_send, discord_send, ai_chatgpt, ai_claude, if_else, loop, http_request, json_parse

Position nodes left-to-right: x increases by 260-300px, y stays around 0-50.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const content = completion.choices[0].message.content;
    if (!content) throw new Error('No response from OpenAI');

    // Extract JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No valid JSON in response');

    const workflow = JSON.parse(jsonMatch[0]);

    // Validate structure
    if (!workflow.nodes || !Array.isArray(workflow.nodes) || workflow.nodes.length === 0) {
      throw new Error('Invalid workflow structure: missing nodes array');
    }
    if (!workflow.edges || !Array.isArray(workflow.edges)) {
      throw new Error('Invalid workflow structure: missing edges array');
    }

    // Update last used
    await prisma.userApiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

    res.json({ workflow });
  } catch (error: any) {
    console.error('AI workflow generation error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to generate workflow',
      hint: error.message?.includes('API key') 
        ? 'Check your OpenAI API key in Settings'
        : undefined
    });
  }
});

export default router;