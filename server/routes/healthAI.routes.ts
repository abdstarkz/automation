// server/routes/healthAI.routes.ts
import { Router } from 'express';
import { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { prisma } from '../server.js';
import { User } from '@prisma/client';
import { GoogleGenAI } from '@google/genai';
import { encrypt, decrypt } from '../utils/encryption.js'; 

const router = Router();

// ============================================
// API KEY MANAGEMENT
// ============================================

// Store/Update Gemini API Key
router.post('/api-key', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { apiKey, service = 'gemini' } = req.body;

    if (!apiKey) {
      return res.status(400).json({ message: 'API key is required' });
    }

    // Test the API key before saving
    try {
      const genAI = new GoogleGenAI({ apiKey });
      await genAI.models.generateContent({ model: 'gemini-2.5-flash', contents: 'test' });
      console.log('[HealthAI] API key validated successfully');
    } catch (error) {
      console.error('[HealthAI] Invalid API key:', error);
      return res.status(400).json({ message: 'Invalid API key. Please check and try again.' });
    }

    const encryptedKey = encrypt(apiKey);

    await prisma.userApiKey.upsert({
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
      },
    });

    console.log(`[HealthAI] API key saved for user ${user.id}`);
    res.json({ success: true, hasKey: true });
  } catch (error: any) {
    console.error('[HealthAI] Error saving API key:', error);
    res.status(500).json({ message: 'Failed to save API key' });
  }
});

// Check if user has API key
router.get('/api-key/status', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { service = 'gemini' } = req.query;

    const apiKey = await prisma.userApiKey.findUnique({
      where: {
        userId_service: {
          userId: user.id,
          service: service as string,
        },
      },
    });

    res.json({
      hasKey: !!apiKey?.isActive,
      lastUsed: apiKey?.lastUsedAt,
    });
  } catch (error) {
    console.error('[HealthAI] Error checking API key:', error);
    res.status(500).json({ message: 'Failed to check API key status' });
  }
});

// Delete API key
router.delete('/api-key', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { service = 'gemini' } = req.query;

    await prisma.userApiKey.delete({
      where: {
        userId_service: {
          userId: user.id,
          service: service as string,
        },
      },
    });

    console.log(`[HealthAI] API key deleted for user ${user.id}`);
    res.json({ success: true });
  } catch (error) {
    console.error('[HealthAI] Error deleting API key:', error);
    res.status(500).json({ message: 'Failed to delete API key' });
  }
});

// ============================================
// SESSION MANAGEMENT
// ============================================

// Create new analysis session
router.post('/sessions', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { dateRange, startDate, endDate, title } = req.body;

    const session = await prisma.healthAnalysisSession.create({
      data: {
        userId: user.id,
        title: title || `Health Analysis - ${dateRange}`,
        dateRange,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      },
    });

    console.log(`[HealthAI] Session created: ${session.id}`);
    res.json(session);
  } catch (error) {
    console.error('[HealthAI] Error creating session:', error);
    res.status(500).json({ message: 'Failed to create analysis session' });
  }
});

// Get user's analysis sessions
router.get('/sessions', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as User;

    const sessions = await prisma.healthAnalysisSession.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });

    res.json(sessions);
  } catch (error) {
    console.error('[HealthAI] Error fetching sessions:', error);
    res.status(500).json({ message: 'Failed to fetch sessions' });
  }
});

// Get session with messages
router.get('/sessions/:sessionId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { sessionId } = req.params;

    const session = await prisma.healthAnalysisSession.findFirst({
      where: {
        id: sessionId,
        userId: user.id,
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    res.json(session);
  } catch (error) {
    console.error('[HealthAI] Error fetching session:', error);
    res.status(500).json({ message: 'Failed to fetch session' });
  }
});

// Delete session
router.delete('/sessions/:sessionId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { sessionId } = req.params;

    await prisma.healthAnalysisSession.deleteMany({
      where: {
        id: sessionId,
        userId: user.id,
      },
    });

    console.log(`[HealthAI] Session deleted: ${sessionId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('[HealthAI] Error deleting session:', error);
    res.status(500).json({ message: 'Failed to delete session' });
  }
});

// ============================================
// AI ANALYSIS
// ============================================

// Analyze health data with AI
router.post('/analyze', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { sessionId, message, startDate, endDate } = req.body;

    console.log(`[HealthAI] Analysis requested for session ${sessionId}`);

    // Get user's API key
    const apiKeyRecord = await prisma.userApiKey.findUnique({
      where: {
        userId_service: {
          userId: user.id,
          service: 'gemini',
        },
      },
    });

    if (!apiKeyRecord || !apiKeyRecord.isActive) {
      return res.status(400).json({ 
        message: 'Please configure your Gemini API key in Settings first' 
      });
    }

    const apiKey = decrypt(apiKeyRecord.encryptedKey);

    // Fetch comprehensive health data
    console.log('[HealthAI] Fetching health data...');
    const [healthData, activities, foods, personalTime] = await Promise.all([
      prisma.healthData.findMany({
        where: {
          userId: user.id,
          recordedAt: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        },
        orderBy: { recordedAt: 'asc' },
      }),
      prisma.fitbitActivity.findMany({
        where: {
          userId: user.id,
          recordedAt: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        },
        orderBy: { startTime: 'asc' },
      }),
      prisma.fitbitFood.findMany({
        where: {
          userId: user.id,
          recordedDate: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        },
        orderBy: { loggedAt: 'asc' },
      }),
      prisma.personalTimeActivity.findMany({
        where: {
          userId: user.id,
          date: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        },
        orderBy: { date: 'asc' },
      }),
    ]);

    console.log(`[HealthAI] Data fetched: ${healthData.length} health records, ${activities.length} activities, ${foods.length} foods, ${personalTime.length} personal time`);

    // Process and aggregate data
    const aggregatedData = processHealthData(healthData, activities, foods, personalTime);

    // Create context for AI
    const contextPrompt = `You are a professional health analysis assistant with expertise in fitness, nutrition, and wellness. Analyze the following health data and provide comprehensive, actionable insights.

**Analysis Period:** ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}

**Health Metrics Summary:**
- Average Daily Steps: ${aggregatedData.summary.avgSteps.toLocaleString()} steps
- Average Daily Calories Burned: ${aggregatedData.summary.avgCalories.toLocaleString()} kcal
- Average Sleep: ${aggregatedData.summary.avgSleep.toFixed(1)} hours/night
- Average Active Minutes: ${aggregatedData.summary.avgActiveMinutes} minutes/day
- Average Resting Heart Rate: ${aggregatedData.summary.avgHeartRate} bpm
- Total Distance: ${aggregatedData.summary.totalDistance.toFixed(2)} km

**Activity Breakdown:**
- Total Workouts: ${aggregatedData.summary.totalActivities}
- Activity Types: ${[...new Set(activities.map(a => a.activityName))].join(', ') || 'None'}
- Most Active Day: ${activities.length > 0 ? new Date(activities.sort((a,b) => b.duration - a.duration)[0]?.startTime).toLocaleDateString() : 'N/A'}

**Nutrition Overview:**
- Total Food Logs: ${aggregatedData.summary.totalFoodLogs}
- Average Daily Calories Intake: ${aggregatedData.nutrition.avgCalories.toLocaleString()} kcal
- Average Macros: ${aggregatedData.nutrition.avgCarbs}g carbs, ${aggregatedData.nutrition.avgFat}g fat, ${aggregatedData.nutrition.avgProtein}g protein

**Personal Time & Wellness:**
- Total Personal Time: ${aggregatedData.summary.personalTimeHours.toFixed(1)} hours
- Activities: ${[...new Set(personalTime.map(p => p.activityType))].join(', ') || 'None'}

**Daily Pattern Sample (Last 5 Days):**
${aggregatedData.daily.slice(-5).map(day => 
  `- ${new Date(day.date).toLocaleDateString()}: ${day.steps} steps, ${day.sleep.toFixed(1)}h sleep, ${day.activeMinutes} active min, ${day.calories} kcal burned`
).join('\n')}

**User Question:** ${message}

Please provide a comprehensive analysis that includes:

1. **Key Patterns & Trends**: Identify significant patterns in the data
2. **Strengths & Achievements**: Highlight positive behaviors and accomplishments
3. **Areas for Improvement**: Point out aspects that could be optimized
4. **Specific Recommendations**: Provide 3-5 actionable recommendations
5. **Health Insights**: Any correlations or insights between different metrics
6. **Concerns (if any)**: Flag any potential health concerns that warrant attention

Format your response in clear markdown with headers and bullet points. Be encouraging, specific, and practical in your recommendations.`;

    // Call Gemini API
    console.log('[HealthAI] Calling Gemini API...');
    const genAI = new GoogleGenAI({ apiKey });
    const result = await genAI.models.generateContent({ model: 'gemini-2.5-flash', contents: contextPrompt });
    const analysisText = result.text || '';

    console.log(`[HealthAI] Analysis generated (${analysisText.length} chars)`);

    // Save user message
    await prisma.healthAnalysisMessage.create({
      data: {
        sessionId,
        role: 'user',
        content: message,
        metadata: {
          dataRange: { startDate, endDate },
          dataSummary: aggregatedData.summary,
        },
      },
    });

    // Save AI response
    const aiMessage = await prisma.healthAnalysisMessage.create({
      data: {
        sessionId,
        role: 'assistant',
        content: analysisText,
        metadata: {
          model: 'gemini-2.5-flash',
          timestamp: new Date().toISOString(),
          dataPoints: {
            healthRecords: healthData.length,
            activities: activities.length,
            foodLogs: foods.length,
            personalTime: personalTime.length,
          },
        },
      },
    });

    // Update API key last used
    await prisma.userApiKey.update({
      where: {
        userId_service: {
          userId: user.id,
          service: 'gemini',
        },
      },
      data: { lastUsedAt: new Date() },
    });

    console.log('[HealthAI] Analysis completed successfully');

    res.json({
      analysis: analysisText,
      message: aiMessage,
      dataInsights: aggregatedData.summary,
    });
  } catch (error: any) {
    console.error('[HealthAI] Error analyzing data:', error);
    
    if (error.message?.includes('API key') || error.message?.includes('PERMISSION_DENIED')) {
      return res.status(400).json({ 
        message: 'Invalid or expired API key. Please update it in Settings.' 
      });
    }
    
    if (error.message?.includes('quota') || error.message?.includes('RESOURCE_EXHAUSTED')) {
      return res.status(429).json({ 
        message: 'API quota exceeded. Please try again later or check your Gemini API limits.' 
      });
    }
    
    res.status(500).json({ 
      message: 'Failed to analyze health data. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function processHealthData(
  healthData: any[],
  activities: any[],
  foods: any[],
  personalTime: any[]
) {
  // Group by date
  const dailyMap = new Map<string, any>();

  // Process health data
  healthData.forEach(item => {
    const date = item.recordedAt.toISOString().split('T')[0];
    if (!dailyMap.has(date)) {
      dailyMap.set(date, {
        date,
        steps: 0,
        calories: 0,
        sleep: 0,
        activeMinutes: 0,
        heartRate: 0,
        water: 0,
        distance: 0,
      });
    }

    const daily = dailyMap.get(date);
    const value = Number(item.value) || 0;

    // Round appropriately based on data type
    if (item.dataType === 'steps') daily.steps = Math.round(value);
    if (item.dataType === 'calories') daily.calories = Math.round(value);
    if (item.dataType === 'sleep') daily.sleep = parseFloat((value / 60).toFixed(1)); // Convert minutes to hours
    if (item.dataType === 'active_minutes') daily.activeMinutes = Math.round(value);
    if (item.dataType === 'heart_rate') daily.heartRate = Math.round(value);
    if (item.dataType === 'water') daily.water = Math.round(value);
    if (item.dataType === 'distance') daily.distance = parseFloat(value.toFixed(2));
  });

  const daily = Array.from(dailyMap.values());
  const daysCount = daily.length || 1;

  // Calculate averages with proper rounding
  const summary = {
    avgSteps: Math.round(daily.reduce((sum, d) => sum + d.steps, 0) / daysCount),
    avgCalories: Math.round(daily.reduce((sum, d) => sum + d.calories, 0) / daysCount),
    avgSleep: parseFloat((daily.reduce((sum, d) => sum + d.sleep, 0) / daysCount).toFixed(1)),
    avgActiveMinutes: Math.round(daily.reduce((sum, d) => sum + d.activeMinutes, 0) / daysCount),
    avgHeartRate: Math.round(daily.reduce((sum, d) => sum + d.heartRate, 0) / daysCount),
    avgWater: Math.round(daily.reduce((sum, d) => sum + d.water, 0) / daysCount),
    totalDistance: parseFloat(daily.reduce((sum, d) => sum + d.distance, 0).toFixed(2)),
    totalActivities: activities.length,
    totalFoodLogs: foods.length,
    personalTimeHours: personalTime.reduce((sum, p) => sum + (p.duration || 0), 0) / 60,
  };

  // Calculate nutrition averages with proper rounding
  const nutrition = {
    avgCalories: Math.round(foods.reduce((sum, f) => sum + (Number(f.calories) || 0), 0) / daysCount),
    avgCarbs: Math.round(foods.reduce((sum, f) => sum + (Number(f.carbs) || 0), 0) / daysCount),
    avgFat: Math.round(foods.reduce((sum, f) => sum + (Number(f.fat) || 0), 0) / daysCount),
    avgProtein: Math.round(foods.reduce((sum, f) => sum + (Number(f.protein) || 0), 0) / daysCount),
  };

  return { summary, daily, nutrition };
}

export default router;