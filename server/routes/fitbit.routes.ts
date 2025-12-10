// server/routes/fitbit.routes.ts
import { Router } from 'express';
import { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import axios from 'axios';
import { prisma } from '../prisma.js';             
import { encrypt, decrypt } from '../utils/encryption.js';                            
import { User } from '@prisma/client';
import { toStartOfDayUTC, toDateString, createDateRange } from '../utils/dateUtils.js';

const router = Router();

const FITBIT_CLIENT_ID = process.env.VITE_FITBIT_CLIENT_ID;
const FITBIT_CLIENT_SECRET = process.env.VITE_FITBIT_CLIENT_SECRET;
const FITBIT_REDIRECT_URI = process.env.VITE_FITBIT_CALLBACK_URL || 'http://localhost:5173/auth/fitbit/callback';


// Exchange authorization code for tokens
router.post('/callback', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    console.log('[Fitbit] Received authorization code');

    if (!code) {
      return res.status(400).json({ message: 'Authorization code required' });
    }

    const user = req.user as User;

    const tokenResponse = await axios.post(
      'https://api.fitbit.com/oauth2/token',
      new URLSearchParams({
        client_id: FITBIT_CLIENT_ID!,
        grant_type: 'authorization_code',
        redirect_uri: FITBIT_REDIRECT_URI,
        code: code,
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(
            `${FITBIT_CLIENT_ID!.trim()}:${FITBIT_CLIENT_SECRET!.trim()}`
          ).toString('base64')}`,
        },
      }
    );

    console.log('[Fitbit] Token exchange successful');
    const { access_token, refresh_token, expires_in, scope } = tokenResponse.data;

    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + expires_in);

    await prisma.fitbitToken.upsert({
      where: { userId: user.id },
      update: {
        accessToken: encrypt(access_token),
        refreshToken: encrypt(refresh_token),
        expiresAt,
        scope: scope.split(' '),
        updatedAt: new Date(),
      },
      create: {
        userId: user.id,
        accessToken: encrypt(access_token),
        refreshToken: encrypt(refresh_token),
        expiresAt,
        scope: scope.split(' '),
      },
    });

    // Initial sync for today
    const today = toDateString(new Date());
    try {
      await syncUserFitbitData(user.id, access_token, today);
      console.log('[Fitbit] Initial sync completed');
    } catch (syncError) {
      console.error('[Fitbit] Initial sync failed:', syncError);
    }

    res.json({
      message: 'Fitbit connected successfully',
      connected: true,
    });
  } catch (error: any) {
    console.error('[Fitbit] Callback error:', error.response?.data || error.message);
    res.status(500).json({ 
      message: 'Failed to connect Fitbit',
      error: error.response?.data?.errors?.[0]?.message || error.message
    });
  }
});

router.get('/status', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const fitbitToken = await prisma.fitbitToken.findUnique({
      where: { userId: user.id },
    });

    res.json({
      connected: !!fitbitToken,
      lastSync: fitbitToken?.updatedAt,
      expiresAt: fitbitToken?.expiresAt,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to check Fitbit status' });
  }
});

router.delete('/disconnect', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    await prisma.fitbitToken.delete({
      where: { userId: user.id },
    });
    res.json({ message: 'Fitbit disconnected successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to disconnect Fitbit' });
  }
});

router.post('/sync', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { date } = req.body;
    const user = req.user as User;
    const targetDate = date ? toDateString(date) : toDateString(new Date());
    
    console.log('[Fitbit] Sync requested for date:', targetDate);

    const fitbitToken = await prisma.fitbitToken.findUnique({
      where: { userId: user.id },
    });

    if (!fitbitToken) {
      return res.status(404).json({ message: 'Fitbit not connected' });
    }

    let accessToken = decrypt(fitbitToken.accessToken);
    
    if (new Date() >= fitbitToken.expiresAt) {
      console.log('[Fitbit] Token expired, refreshing...');
      accessToken = await refreshFitbitToken(user.id);
    }

    await syncUserFitbitData(user.id, accessToken, targetDate);

    res.json({ 
      message: 'Sync completed successfully',
      date: targetDate
    });
  } catch (error: any) {
    console.error('[Fitbit] Sync error:', error.response?.data || error.message);
    
    if (error.response?.status === 429) {
      return res.status(429).json({ 
        message: 'Rate limit exceeded. Please wait a few minutes before syncing again.',
        error: 'RATE_LIMIT'
      });
    }
    
    res.status(500).json({ 
      message: 'Failed to sync Fitbit data',
      error: error.message
    });
  }
});

async function refreshFitbitToken(userId: string): Promise<string> {
  const fitbitToken = await prisma.fitbitToken.findUnique({
    where: { userId },
  });

  if (!fitbitToken) {
    throw new Error('No Fitbit token found');
  }

  const refreshToken = decrypt(fitbitToken.refreshToken);

  const response = await axios.post(
    'https://api.fitbit.com/oauth2/token',
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(
          `${FITBIT_CLIENT_ID!.trim()}:${FITBIT_CLIENT_SECRET!.trim()}`
        ).toString('base64')}`,
      },
    }
  );

  const { access_token, refresh_token: new_refresh_token, expires_in } = response.data;
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + expires_in);

  await prisma.fitbitToken.update({
    where: { userId },
    data: {
      accessToken: encrypt(access_token),
      refreshToken: encrypt(new_refresh_token),
      expiresAt,
      updatedAt: new Date(),
    },
  });

  return access_token;
}

async function syncUserFitbitData(userId: string, accessToken: string, dateInput: string | Date) {
  const targetDate = toDateString(dateInput);
  const recordedAt = toStartOfDayUTC(targetDate);
  
  console.log(`[Fitbit] ═══════════════════════════════════════`);
  console.log(`[Fitbit] Starting sync for: ${targetDate}`);
  console.log(`[Fitbit] RecordedAt UTC: ${recordedAt.toISOString()}`);
  console.log(`[Fitbit] ═══════════════════════════════════════`);

  try {
    // 1. HEALTH DATA (steps, calories, active minutes, distance)
    const activitiesResponse = await axios.get(
      `https://api.fitbit.com/1/user/-/activities/date/${targetDate}.json`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const activities = activitiesResponse.data.summary;
    console.log('[Fitbit] ✓ Fetched activities summary');

    // Store steps
    const stepsValue = parseInt(activities?.steps || 0);
    await prisma.healthData.upsert({
      where: {
        userId_dataType_recordedAt: { userId, dataType: 'steps', recordedAt },
      },
      update: { value: stepsValue, source: 'fitbit' },
      create: {
        userId, dataType: 'steps', value: stepsValue,
        unit: 'steps', recordedAt, source: 'fitbit',
      },
    });
    console.log(`[Fitbit] ✓ Steps: ${stepsValue}`);

    // Store calories
    const caloriesValue = parseInt(activities?.caloriesOut || activities?.calories || 0);
    await prisma.healthData.upsert({
      where: {
        userId_dataType_recordedAt: { userId, dataType: 'calories', recordedAt },
      },
      update: { value: caloriesValue, source: 'fitbit' },
      create: {
        userId, dataType: 'calories', value: caloriesValue,
        unit: 'kcal', recordedAt, source: 'fitbit',
      },
    });
    console.log(`[Fitbit] ✓ Calories: ${caloriesValue}`);

    // Store active minutes
    const veryActive = parseInt(activities?.veryActiveMinutes || 0);
    const fairlyActive = parseInt(activities?.fairlyActiveMinutes || 0);
    const lightlyActive = parseInt(activities?.lightlyActiveMinutes || 0);
    const totalActiveMinutes = veryActive + fairlyActive + lightlyActive;
    
    await prisma.healthData.upsert({
      where: {
        userId_dataType_recordedAt: { userId, dataType: 'active_minutes', recordedAt },
      },
      update: { value: totalActiveMinutes, source: 'fitbit' },
      create: {
        userId, dataType: 'active_minutes', value: totalActiveMinutes,
        unit: 'minutes', recordedAt, source: 'fitbit',
        metadata: { veryActive, fairlyActive, lightlyActive },
      },
    });
    console.log(`[Fitbit] ✓ Active minutes: ${totalActiveMinutes}`);

    // Store distance
    if (activities?.distances && Array.isArray(activities.distances)) {
      const totalDistanceEntry = activities.distances.find((d: any) => d.activity === 'total');
      if (totalDistanceEntry) {
        const distanceKm = parseFloat(totalDistanceEntry.distance || 0);
        await prisma.healthData.upsert({
          where: {
            userId_dataType_recordedAt: { userId, dataType: 'distance', recordedAt },
          },
          update: { value: distanceKm, source: 'fitbit' },
          create: {
            userId, dataType: 'distance', value: distanceKm,
            unit: 'km', recordedAt, source: 'fitbit',
          },
        });
        console.log(`[Fitbit] ✓ Distance: ${distanceKm} km`);
      }
    }

    // 2. HEART RATE
    try {
      const heartRateResponse = await axios.get(
        `https://api.fitbit.com/1/user/-/activities/heart/date/${targetDate}/1d.json`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      const heartData = heartRateResponse.data['activities-heart'];
      if (heartData && heartData.length > 0 && heartData[0].value) {
        const restingHR = parseInt(heartData[0].value.restingHeartRate || 0);
        if (restingHR > 0) {
          await prisma.healthData.upsert({
            where: {
              userId_dataType_recordedAt: { userId, dataType: 'heart_rate', recordedAt },
            },
            update: { value: restingHR, source: 'fitbit' },
            create: {
              userId, dataType: 'heart_rate', value: restingHR,
              unit: 'bpm', recordedAt, source: 'fitbit',
            },
          });
          console.log(`[Fitbit] ✓ Heart rate: ${restingHR} bpm`);
        }
      }
    } catch (error: any) {
      console.log('[Fitbit] ⓘ Heart rate not available');
    }

    // 3. SLEEP
    try {
      const sleepResponse = await axios.get(
        `https://api.fitbit.com/1.2/user/-/sleep/date/${targetDate}.json`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      const sleepData = sleepResponse.data;
      if (sleepData?.sleep && sleepData.sleep.length > 0) {
        const mainSleep = sleepData.sleep.reduce((longest: any, current: any) => {
          return (current.minutesAsleep || 0) > (longest.minutesAsleep || 0) ? current : longest;
        }, sleepData.sleep[0]);

        const sleepMinutes = parseInt(mainSleep.minutesAsleep || 0);
        
        if (sleepMinutes > 0) {
          await prisma.healthData.upsert({
            where: {
              userId_dataType_recordedAt: { userId, dataType: 'sleep', recordedAt },
            },
            update: { 
              value: sleepMinutes, 
              source: 'fitbit',
              metadata: {
                stages: mainSleep.levels,
                efficiency: mainSleep.efficiency,
                duration: mainSleep.duration,
              }
            },
            create: {
              userId, dataType: 'sleep', value: sleepMinutes,
              unit: 'minutes', recordedAt, source: 'fitbit',
              metadata: {
                stages: mainSleep.levels,
                efficiency: mainSleep.efficiency,
                duration: mainSleep.duration,
              },
            },
          });
          console.log(`[Fitbit] ✓ Sleep: ${sleepMinutes} min (${(sleepMinutes/60).toFixed(1)}h)`);
        }
      }
    } catch (error: any) {
      console.log('[Fitbit] ⓘ Sleep not available');
    }

    // 4. WATER
    try {
      const waterResponse = await axios.get(
        `https://api.fitbit.com/1/user/-/foods/log/water/date/${targetDate}.json`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      const waterData = waterResponse.data.summary;
      if (waterData?.water) {
        const waterMl = parseFloat(waterData.water || 0);
        if (waterMl > 0) {
          await prisma.healthData.upsert({
            where: {
              userId_dataType_recordedAt: { userId, dataType: 'water', recordedAt },
            },
            update: { value: waterMl, source: 'fitbit' },
            create: {
              userId, dataType: 'water', value: waterMl,
              unit: 'ml', recordedAt, source: 'fitbit',
            },
          });
          console.log(`[Fitbit] ✓ Water: ${waterMl} ml`);
        }
      }
    } catch (error: any) {
      console.log('[Fitbit] ⓘ Water not available');
    }

    // 5. INDIVIDUAL ACTIVITIES (workouts)
    try {
      const activitiesListResponse = await axios.get(
        `https://api.fitbit.com/1/user/-/activities/list.json?afterDate=${targetDate}&sort=asc&offset=0&limit=20`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      const activityList = activitiesListResponse.data.activities || [];
      let storedCount = 0;

      for (const activity of activityList) {
        const startTime = new Date(activity.startTime);
        const activityDate = toDateString(startTime);
        
        // Only store activities for the target date
        if (activityDate === targetDate) {
          const activityIdStr = String(activity.logId);
          
          await prisma.fitbitActivity.upsert({
            where: {
              userId_activityId: { userId, activityId: activityIdStr },
            },
            update: {
              activityName: activity.activityName,
              calories: parseFloat(activity.calories || 0),
              duration: Math.round(parseInt(activity.duration || 0) / 60000) || 0,
              distance: activity.distance ? parseFloat(activity.distance) : null,
              steps: activity.steps ? parseInt(activity.steps) : null,
              startTime,
              recordedAt,
              metadata: {
                activityTypeId: activity.activityTypeId,
                elevationGain: activity.elevationGain,
                averageHeartRate: activity.averageHeartRate,
              },
            },
            create: {
              userId,
              activityId: activityIdStr,
              activityName: activity.activityName,
              calories: parseFloat(activity.calories || 0),
              duration: Math.round(parseInt(activity.duration || 0) / 60000) || 0,
              distance: activity.distance ? parseFloat(activity.distance) : null,
              steps: activity.steps ? parseInt(activity.steps) : null,
              startTime,
              recordedAt,
              metadata: {
                activityTypeId: activity.activityTypeId,
                elevationGain: activity.elevationGain,
                averageHeartRate: activity.averageHeartRate,
              },
            },
          });
          storedCount++;
        }
      }
      console.log(`[Fitbit] ✓ Activities: ${storedCount}`);
    } catch (error: any) {
      console.error('[Fitbit] Activities error:', error.response?.data || error.message);
    }

    // 6. FOOD LOGS
    // 6. FOOD LOGS - ENHANCED NUTRITION EXTRACTION
    try {
      const foodResponse = await axios.get(
        `https://api.fitbit.com/1/user/-/foods/log/date/${targetDate}.json`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      const foods = foodResponse.data.foods || [];
      let storedCount = 0;

      console.log(`[Fitbit] Processing ${foods.length} food logs`);

      for (const food of foods) {
        try {
          const foodIdStr = String(food.logId);
          const loggedFood = food.loggedFood || {};
          
          // CRITICAL: Extract nutrition data with multiple fallback strategies
          let calories = 0;
          let carbs = 0, fat = 0, protein = 0;
          
          console.log(`[Fitbit] Processing food: ${loggedFood.name}`);
          console.log(`[Fitbit] Raw food data:`, JSON.stringify(food, null, 2));
          
          // Strategy 1: Use nutritionalValues (most reliable when present)
          if (food.nutritionalValues) {
            calories = parseFloat(food.nutritionalValues.calories || 0);
            carbs = parseFloat(food.nutritionalValues.carbs || 0);
            fat = parseFloat(food.nutritionalValues.fat || 0);
            protein = parseFloat(food.nutritionalValues.protein || 0);
            console.log(`[Fitbit] Strategy 1 (nutritionalValues): Cal=${calories}, C=${carbs}, F=${fat}, P=${protein}`);
          }
          
          // Strategy 2: Calculate from unit values * amount
          if (calories === 0 && loggedFood.unit) {
            const amount = parseFloat(loggedFood.amount || 1);
            calories = parseFloat(loggedFood.unit.calories || 0) * amount;
            carbs = parseFloat(loggedFood.unit.carbs || 0) * amount;
            fat = parseFloat(loggedFood.unit.fat || 0) * amount;
            protein = parseFloat(loggedFood.unit.protein || 0) * amount;
            console.log(`[Fitbit] Strategy 2 (unit × amount): Cal=${calories}, C=${carbs}, F=${fat}, P=${protein}`);
          }
          
          // Strategy 3: Use loggedFood direct values
          if (calories === 0) {
            calories = parseFloat(loggedFood.calories || 0);
            console.log(`[Fitbit] Strategy 3 (loggedFood.calories): Cal=${calories}`);
          }
          
          // Strategy 4: Try to extract from food.unit if available
          if ((carbs === 0 || fat === 0 || protein === 0) && food.unit) {
            if (carbs === 0) carbs = parseFloat(food.unit.carbs || 0);
            if (fat === 0) fat = parseFloat(food.unit.fat || 0);
            if (protein === 0) protein = parseFloat(food.unit.protein || 0);
            console.log(`[Fitbit] Strategy 4 (food.unit): C=${carbs}, F=${fat}, P=${protein}`);
          }
          
          // Strategy 5: Estimate macros from calories if still missing
          // This is a rough estimate: assume 40% carbs, 30% fat, 30% protein
          if (calories > 0 && (carbs === 0 && fat === 0 && protein === 0)) {
            carbs = (calories * 0.4) / 4; // 4 cal per gram of carbs
            fat = (calories * 0.3) / 9;   // 9 cal per gram of fat
            protein = (calories * 0.3) / 4; // 4 cal per gram of protein
            console.log(`[Fitbit] Strategy 5 (estimated from calories): C=${carbs}, F=${fat}, P=${protein}`);
          }
          
          // Final validation
          if (calories === 0) {
            console.warn(`[Fitbit] ⚠️ No calorie data for ${loggedFood.name}, skipping`);
            continue;
          }
          
          console.log(`[Fitbit] ✓ Final nutrition for ${loggedFood.name}: ${Math.round(calories)} kcal, ${carbs.toFixed(1)}g C, ${fat.toFixed(1)}g F, ${protein.toFixed(1)}g P`);
          
          await prisma.fitbitFood.upsert({
            where: { userId_foodId: { userId, foodId: foodIdStr } },
            update: {
              foodName: loggedFood.name || 'Unknown Food',
              mealType: loggedFood.mealTypeId === 1 ? 'Breakfast' :
                        loggedFood.mealTypeId === 2 ? 'Morning Snack' :
                        loggedFood.mealTypeId === 3 ? 'Lunch' :
                        loggedFood.mealTypeId === 4 ? 'Afternoon Snack' :
                        loggedFood.mealTypeId === 5 ? 'Dinner' : 'Anytime',
              calories: Math.round(calories),
              carbs: Math.round(carbs * 10) / 10,
              fat: Math.round(fat * 10) / 10,
              protein: Math.round(protein * 10) / 10,
              loggedAt: recordedAt,
              recordedDate: recordedAt,
            },
            create: {
              userId,
              foodId: foodIdStr,
              foodName: loggedFood.name || 'Unknown Food',
              mealType: loggedFood.mealTypeId === 1 ? 'Breakfast' :
                        loggedFood.mealTypeId === 2 ? 'Morning Snack' :
                        loggedFood.mealTypeId === 3 ? 'Lunch' :
                        loggedFood.mealTypeId === 4 ? 'Afternoon Snack' :
                        loggedFood.mealTypeId === 5 ? 'Dinner' : 'Anytime',
              calories: Math.round(calories),
              carbs: Math.round(carbs * 10) / 10,
              fat: Math.round(fat * 10) / 10,
              protein: Math.round(protein * 10) / 10,
              loggedAt: recordedAt,
              recordedDate: recordedAt,
            },
          });
          storedCount++;
        } catch (err: any) {
          console.error(`[Fitbit] ❌ Error storing food:`, err.message);
        }
      }
      console.log(`[Fitbit] ✓ Food logs: ${storedCount}/${foods.length} stored`);
    } catch (error: any) {
      console.error('[Fitbit] Food logs error:', error.response?.data || error.message);
    }

    console.log(`[Fitbit] ═══════════════════════════════════════`);
    console.log(`[Fitbit] ✅ Sync completed for ${targetDate}`);
    console.log(`[Fitbit] ═══════════════════════════════════════`);

  } catch (error: any) {
    console.error(`[Fitbit] ❌ Sync failed for ${targetDate}:`, error.response?.data || error.message);
    throw error;
  }
}

// GET ACTIVITIES - with robust date handling
router.get('/activities', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'startDate and endDate are required' });
    }

    const { startDateTime, endDateTime } = createDateRange(startDate as string, endDate as string);

    console.log('[Fitbit] Fetching activities:', {
      user: user.id,
      startDate: startDateTime.toISOString(),
      endDate: endDateTime.toISOString()
    });

    const activities = await prisma.fitbitActivity.findMany({
      where: {
        userId: user.id,
        recordedAt: {
          gte: startDateTime,
          lte: endDateTime,
        },
      },
      orderBy: { startTime: 'desc' },
    });

    console.log(`[Fitbit] Found ${activities.length} activities`);
    res.json(activities);
  } catch (error) {
    console.error('[Fitbit] Error fetching activities:', error);
    res.status(500).json({ message: 'Failed to fetch activities' });
  }
});

// GET FOODS - with robust date handling
router.get('/foods', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'startDate and endDate are required' });
    }

    const { startDateTime, endDateTime } = createDateRange(startDate as string, endDate as string);

    console.log('[Fitbit] Fetching food logs:', {
      user: user.id,
      startDate: startDateTime.toISOString(),
      endDate: endDateTime.toISOString()
    });

    const foods = await prisma.fitbitFood.findMany({
      where: {
        userId: user.id,
        recordedDate: {
          gte: startDateTime,
          lte: endDateTime,
        },
      },
      orderBy: { loggedAt: 'asc' },
    });

    console.log(`[Fitbit] Found ${foods.length} food logs`);

    // Group by meal type
    const groupedByMeal = foods.reduce((acc: any, food: any) => {
      const mealType = food.mealType || 'Anytime';
      if (!acc[mealType]) {
        acc[mealType] = [];
      }
      acc[mealType].push(food);
      return acc;
    }, {});

    res.json(groupedByMeal);
  } catch (error) {
    console.error('[Fitbit] Error fetching food logs:', error);
    res.status(500).json({ message: 'Failed to fetch food logs' });
  }
});

// GET HEALTH DATA
router.get('/data', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'startDate and endDate are required' });
    }

    const { startDateTime, endDateTime } = createDateRange(startDate as string, endDate as string);

    const healthData = await prisma.healthData.findMany({
      where: {
        userId: user.id,
        recordedAt: {
          gte: startDateTime,
          lte: endDateTime,
        },
      },
      orderBy: { recordedAt: 'asc' },
    });

    const groupedData = healthData.reduce((acc: any, item) => {
      const date = toDateString(item.recordedAt);
      if (!acc[date]) {
        acc[date] = {
          date, steps: 0, calories: 0, activeMinutes: 0,
          heartRate: 0, sleep: 0, water: 0, distance: 0,
        };
      }

      const numValue = Number(item.value);

      switch (item.dataType) {
        case 'steps':
          acc[date].steps = Math.round(numValue);
          break;
        case 'calories':
          acc[date].calories = Math.round(numValue);
          break;
        case 'active_minutes':
          acc[date].activeMinutes = Math.round(numValue);
          break;
        case 'heart_rate':
          acc[date].heartRate = Math.round(numValue);
          break;
        case 'sleep':
          acc[date].sleep = parseFloat((numValue / 60).toFixed(1));
          break;
        case 'water':
          acc[date].water = Math.round(numValue);
          break;
        case 'distance':
          acc[date].distance = parseFloat(numValue.toFixed(2));
          break;
      }
      return acc;
    }, {});

    res.json(Object.values(groupedData));
  } catch (error) {
    console.error('[Fitbit] Error fetching health data:', error);
    res.status(500).json({ message: 'Failed to fetch health data' });
  }
});

export default router;