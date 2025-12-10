// routes/personalTime.routes.ts (or whatever your filename is)
import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { Request, Response } from 'express';
import { prisma } from '../prisma.js';
import { User } from '@prisma/client';

const router = Router();

/**
 * POST /activities
 * body: { activityType, duration, date, notes }
 * - duration: number | null
 * - if duration === null -> delete matching activity for date (clear)
 */
router.post('/activities', authenticateToken, async (req: Request, res: Response) => {
  const user = req.user as User;
  try {
    const { activityType, duration, date, notes } = req.body;

    if (!activityType || !date) {
      return res.status(400).json({ message: 'activityType and date are required' });
    }

    // treat empty string as null
    const dur = duration === '' ? null : duration;

    // Clear (delete) when duration === null
    if (dur === null) {
      const deleted = await prisma.personalTimeActivity.deleteMany({
        where: {
          userId: user.id,
          activityType,
          date: new Date(date)
        }
      });
      return res.status(200).json({ cleared: true, deletedCount: deleted.count });
    }

    // Validate numeric duration
    const durationNum = Number(dur);
    if (!Number.isFinite(durationNum) || Number.isNaN(durationNum) || durationNum < 0) {
      return res.status(400).json({ message: 'Invalid duration value' });
    }

    const activity = await prisma.personalTimeActivity.create({
      data: {
        userId: user.id,
        activityType,
        duration: Math.floor(durationNum),
        date: new Date(date),
        notes: notes || null,
      }
    });

    return res.status(201).json(activity);
  } catch (error: any) {
    console.error('[PersonalTime] /activities error:', error?.stack || error);
    // In dev it's helpful to include the message; avoid exposing stack in prod
    return res.status(500).json({ message: error?.message || 'Failed to log activity' });
  }
});

/**
 * GET /activities?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
router.get('/activities', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'startDate and endDate are required' });
    }

    const activities = await prisma.personalTimeActivity.findMany({
      where: {
        userId: user.id,
        date: {
          gte: new Date(String(startDate)),
          lte: new Date(String(endDate)),
        }
      },
      orderBy: { date: 'desc' }
    });

    return res.json(activities);
  } catch (error: any) {
    console.error('[PersonalTime] GET /activities error:', error?.stack || error);
    return res.status(500).json({ message: error?.message || 'Failed to fetch activities' });
  }
});

/**
 * POST /goals
 * body: { activityType, weeklyGoal }
 * - weeklyGoal may be number|string|null
 * - if weeklyGoal === null or '' => clear/delete the goal
 */
router.post('/goals', authenticateToken, async (req: Request, res: Response) => {
  const user = req.user as User;
  try {
    const { activityType, weeklyGoal } = req.body;

    if (!activityType) {
      return res.status(400).json({ message: 'activityType is required' });
    }

    // treat empty string as null
    if (weeklyGoal === '' || weeklyGoal === undefined) {
      // interpret as clear
      const deleted = await prisma.personalTimeGoal.deleteMany({
        where: { userId: user.id, activityType }
      });
      return res.status(200).json({ cleared: true, deletedCount: deleted.count });
    }

    if (weeklyGoal === null) {
      const deleted = await prisma.personalTimeGoal.deleteMany({
        where: { userId: user.id, activityType }
      });
      return res.status(200).json({ cleared: true, deletedCount: deleted.count });
    }

    const parsed = Number(weeklyGoal);
    if (!Number.isFinite(parsed) || Number.isNaN(parsed) || parsed < 0) {
      return res.status(400).json({ message: 'Invalid weeklyGoal' });
    }
    const weeklyGoalNum = Math.floor(parsed);

    const goal = await prisma.personalTimeGoal.upsert({
      where: {
        userId_activityType: {
          userId: user.id,
          activityType
        }
      },
      update: { weeklyGoal: weeklyGoalNum, isActive: true },
      create: { userId: user.id, activityType, weeklyGoal: weeklyGoalNum }
    });

    return res.json(goal);
  } catch (error: any) {
    console.error('[PersonalTime] /goals error:', error?.stack || error);
    return res.status(500).json({ message: error?.message || 'Failed to set goal' });
  }
});

/**
 * GET /goals
 */
router.get('/goals', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const goals = await prisma.personalTimeGoal.findMany({
      where: { userId: user.id, isActive: true }
    });
    return res.json(goals);
  } catch (error: any) {
    console.error('[PersonalTime] GET /goals error:', error?.stack || error);
    return res.status(500).json({ message: error?.message || 'Failed to fetch goals' });
  }
});

export default router;
