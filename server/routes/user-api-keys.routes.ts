// server/routes/user-api-keys.routes.ts
import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { encrypt, decrypt } from '../services/auth/oauth.service.js';

const router = Router();
const prisma = new PrismaClient();

// ============================================
// GET ALL USER API KEYS
// ============================================

router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;

    const apiKeys = await prisma.userApiKey.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        service: true,
        isActive: true,
        lastUsedAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json({ apiKeys });
  } catch (error: any) {
    console.error('Get API keys error:', error);
    res.status(500).json({ error: 'Failed to fetch API keys' });
  }
});

// ============================================
// ADD OR UPDATE API KEY
// ============================================

router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const { service, apiKey } = req.body;

    if (!service || !apiKey) {
      return res.status(400).json({ error: 'Service and API key are required' });
    }

    // Validate service
    const validServices = ['openai', 'anthropic', 'gemini', 'cohere', 'huggingface'];
    if (!validServices.includes(service)) {
      return res.status(400).json({ error: 'Invalid service' });
    }

    // Basic validation of API key format
    const keyPatterns: Record<string, RegExp> = {
      openai: /^sk-[a-zA-Z0-9-_]{20,}$/,
      anthropic: /^sk-ant-[a-zA-Z0-9-]+$/,
      gemini: /^AIza[a-zA-Z0-9_-]{35}$/,
      cohere: /^[a-zA-Z0-9]{40}$/,
      huggingface: /^hf_[a-zA-Z0-9]{32,}$/,
    };

    if (keyPatterns[service] && !keyPatterns[service].test(apiKey)) {
      return res.status(400).json({ 
        error: `Invalid ${service} API key format`,
        hint: `${service} keys should start with the correct prefix`
      });
    }

    // Encrypt the API key
    const encryptedKey = encrypt(apiKey);

    // Upsert the API key
    const savedKey = await prisma.userApiKey.upsert({
      where: {
        userId_service: {
          userId: user.id,
          service,
        },
      },
      update: {
        encryptedKey,
        isActive: true,
        updatedAt: new Date(),
      },
      create: {
        userId: user.id,
        service,
        encryptedKey,
        isActive: true,
      },
      select: {
        id: true,
        service: true,
        isActive: true,
        createdAt: true,
      },
    });

    res.json({
      message: 'API key saved successfully',
      apiKey: savedKey,
    });
  } catch (error: any) {
    console.error('Save API key error:', error);
    res.status(500).json({ error: 'Failed to save API key' });
  }
});

// ============================================
// DELETE API KEY
// ============================================

router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const { id } = req.params;

    await prisma.userApiKey.delete({
      where: {
        id,
        userId: user.id,
      },
    });

    res.json({ message: 'API key deleted successfully' });
  } catch (error: any) {
    console.error('Delete API key error:', error);
    res.status(500).json({ error: 'Failed to delete API key' });
  }
});

// ============================================
// TOGGLE API KEY STATUS
// ============================================

router.patch('/:id/toggle', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const { id } = req.params;

    const apiKey = await prisma.userApiKey.findUnique({
      where: { id, userId: user.id },
    });

    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found' });
    }

    const updatedKey = await prisma.userApiKey.update({
      where: { id },
      data: {
        isActive: !apiKey.isActive,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        service: true,
        isActive: true,
      },
    });

    res.json({
      message: 'API key status updated',
      apiKey: updatedKey,
    });
  } catch (error: any) {
    console.error('Toggle API key error:', error);
    res.status(500).json({ error: 'Failed to update API key status' });
  }
});

// ============================================
// TEST API KEY
// ============================================

router.post('/:id/test', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const { id } = req.params;

    const apiKey = await prisma.userApiKey.findUnique({
      where: { id, userId: user.id },
    });

    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found' });
    }

    const decryptedKey = decrypt(apiKey.encryptedKey);

    // Test the API key based on service
    let testResult;

    switch (apiKey.service) {
      case 'openai':
        testResult = await testOpenAIKey(decryptedKey);
        break;
      case 'anthropic':
        testResult = await testAnthropicKey(decryptedKey);
        break;
      case 'gemini':
        testResult = await testGeminiKey(decryptedKey);
        break;
      default:
        return res.status(400).json({ error: 'Service testing not implemented' });
    }

    // Update last used timestamp
    await prisma.userApiKey.update({
      where: { id },
      data: { lastUsedAt: new Date() },
    });

    res.json(testResult);
  } catch (error: any) {
    console.error('Test API key error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ============================================
// HELPER FUNCTIONS FOR TESTING KEYS
// ============================================

async function testOpenAIKey(apiKey: string) {
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error('Invalid OpenAI API key');
    }

    const data = await response.json();

    return {
      success: true,
      message: 'OpenAI API key is valid',
      data: {
        modelsCount: data.data?.length || 0,
        hasGPT4: data.data?.some((m: any) => m.id.includes('gpt-4')),
      },
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message,
    };
  }
}

async function testAnthropicKey(apiKey: string) {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'test' }],
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Invalid Anthropic API key');
    }

    return {
      success: true,
      message: 'Anthropic API key is valid',
      data: {
        model: 'claude-3-haiku-20240307',
      },
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message,
    };
  }
}

async function testGeminiKey(apiKey: string) {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`
    );

    if (!response.ok) {
      throw new Error('Invalid Google Gemini API key');
    }

    const data = await response.json();

    return {
      success: true,
      message: 'Google Gemini API key is valid',
      data: {
        modelsCount: data.models?.length || 0,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message,
    };
  }
}

// ============================================
// HELPER FUNCTION FOR WORKFLOW EXECUTOR
// ============================================

export async function getUserApiKey(userId: string, service: string) {
  const apiKey = await prisma.userApiKey.findFirst({
    where: {
      userId,
      service,
      isActive: true,
    },
  });

  if (!apiKey) {
    throw new Error(`No active ${service} API key found. Please add one in Settings.`);
  }

  // Update last used
  await prisma.userApiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  });

  return decrypt(apiKey.encryptedKey);
}

export default router;