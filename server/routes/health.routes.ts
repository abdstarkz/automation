import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { Request, Response } from 'express';
import { prisma } from '../prisma.js';
import { User } from '@prisma/client';
import { createDateRange, toDateString } from '../utils/dateUtils.js';
const router = Router();
function safeParseNumber(value: any): number {
if (value === null || value === undefined) return 0;
const num = typeof value === 'string' ? parseFloat(value) : Number(value);
return isNaN(num) || !isFinite(num) ? 0 : num;
}
router.get('/data/summary', authenticateToken, async (req: Request, res: Response) => {
try {
const user = req.user as User;
const { startDate: startDateStr, endDate: endDateStr } = req.query;
if (!startDateStr || !endDateStr) {
  return res.status(400).json({ message: 'startDate and endDate are required' });
}

console.log(`[Health] Fetching summary from ${startDateStr} to ${endDateStr}`);

const { startDateTime, endDateTime } = createDateRange(startDateStr as string, endDateStr as string);

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

console.log(`[Health] Found ${healthData.length} records`);

const dailyDataMap = new Map<string, any>();

healthData.forEach(item => {
  const date = toDateString(item.recordedAt);
  
  if (!dailyDataMap.has(date)) {
    dailyDataMap.set(date, {
      date,
      steps: [],
      calories: [],
      active_minutes: [],
      heart_rate: [],
      sleep: [],
      water: [],
      distance: [],
    });
  }

  const dailyEntry = dailyDataMap.get(date);
  const numValue = safeParseNumber(item.value);

  if (item.dataType === 'steps') dailyEntry.steps.push(numValue);
  if (item.dataType === 'calories') dailyEntry.calories.push(numValue);
  if (item.dataType === 'active_minutes') dailyEntry.active_minutes.push(numValue);
  if (item.dataType === 'heart_rate') dailyEntry.heart_rate.push(numValue);
  if (item.dataType === 'sleep') dailyEntry.sleep.push(numValue);
  if (item.dataType === 'water') dailyEntry.water.push(numValue);
  if (item.dataType === 'distance') dailyEntry.distance.push(numValue);
});

const dailySummaries: any[] = [];
dailyDataMap.forEach((value, key) => {
  dailySummaries.push({
    date: key,
    steps: value.steps.length > 0 ? Math.round(value.steps.reduce((a: number, b: number) => a + b, 0) / value.steps.length) : 0,
    calories: value.calories.length > 0 ? Math.round(value.calories.reduce((a: number, b: number) => a + b, 0) / value.calories.length) : 0,
    activeMinutes: value.active_minutes.length > 0 ? Math.round(value.active_minutes.reduce((a: number, b: number) => a + b, 0) / value.active_minutes.length) : 0,
    heartRate: value.heart_rate.length > 0 ? Math.round(value.heart_rate.reduce((a: number, b: number) => a + b, 0) / value.heart_rate.length) : 0,
    sleep: value.sleep.length > 0 ? parseFloat(((value.sleep.reduce((a: number, b: number) => a + b, 0) / value.sleep.length) / 60).toFixed(1)) : 0,
    water: value.water.length > 0 ? Math.round(value.water.reduce((a: number, b: number) => a + b, 0) / value.water.length) : 0,
    distance: value.distance.length > 0 ? parseFloat((value.distance.reduce((a: number, b: number) => a + b, 0) / value.distance.length).toFixed(2)) : 0,
  });
});

dailySummaries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

if (dailySummaries.length === 0 && startDateStr === endDateStr) {
  dailySummaries.push({
    date: startDateStr,
    steps: 0,
    calories: 0,
    activeMinutes: 0,
    heartRate: 0,
    sleep: 0,
    water: 0,
    distance: 0,
  });
}

console.log(`[Health] Returning ${dailySummaries.length} daily summaries`);
res.json(dailySummaries);
} catch (error) {
console.error('[Health] Get health summary error:', error);
res.status(500).json({ message: 'Failed to fetch health summary' });
}
});
router.get('/data', authenticateToken, async (req: Request, res: Response) => {
try {
const user = req.user as User;
const { dataType, limit = 100 } = req.query;
const where: any = { userId: user.id };
if (dataType) {
  where.dataType = dataType as string;
}

const healthData = await prisma.healthData.findMany({
  where,
  orderBy: { recordedAt: 'desc' },
  take: parseInt(limit as string),
});

res.json({ healthData });
} catch (error) {
console.error('[Health] Get health data error:', error);
res.status(500).json({ message: 'Failed to fetch health data' });
}
});
router.get('/insights', authenticateToken, async (req: Request, res: Response) => {
try {
const user = req.user as User;
const insights = await prisma.healthInsight.findMany({
where: { userId: user.id },
orderBy: { createdAt: 'desc' },
take: 10,
});
res.json({ insights });
} catch (error) {
console.error('[Health] Get insights error:', error);
res.status(500).json({ message: 'Failed to fetch insights' });
}
});
router.post('/data', authenticateToken, async (req: Request, res: Response) => {
try {
const user = req.user as User;
const { dataType, value, unit, recordedAt, metadata } = req.body;
const healthData = await prisma.healthData.create({
  data: {
    userId: user.id,
    dataType,
    value: parseFloat(value),
    unit,
    recordedAt: recordedAt ? new Date(recordedAt) : new Date(),
    metadata: metadata || {},
    source: 'manual',
  },
});

res.status(201).json({ healthData });
} catch (error) {
console.error('[Health] Create health data error:', error);
res.status(500).json({ message: 'Failed to create health data' });
}
});
export default router;