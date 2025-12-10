// server/routes/schedule.routes.ts
import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { PrismaClient, User } from '@prisma/client';
import { CronExpressionParser } from 'cron-parser';

const router = Router();
const prisma = new PrismaClient();

// Create schedule
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { workflowId, cronExpression, timezone } = req.body;

    // Verify workflow ownership
    const workflow = await prisma.workflow.findFirst({
      where: {
        id: workflowId,
        userId: user.id,
      },
    });

    if (!workflow) {
      return res.status(404).json({ message: 'Workflow not found' });
    }

    // Parse cron and compute next run
    const interval = CronExpressionParser.parse(cronExpression, {
      tz: timezone || 'UTC',
    });
    const nextRun = interval.next().toDate();

    const schedule = await prisma.workflowSchedule.create({
      data: {
        workflowId,
        cronExpression,
        timezone: timezone || 'UTC',
        nextRun,
        isActive: true,
      },
    });

    res.status(201).json({ schedule });
  } catch (error) {
    console.error('Create schedule error:', error);
    res.status(500).json({ message: 'Failed to create schedule' });
  }
});

// Get all schedules for user
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as User;

    const schedules = await prisma.workflowSchedule.findMany({
      where: {
        workflow: {
          userId: user.id,
        },
      },
      include: {
        workflow: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json({ schedules });
  } catch (error) {
    console.error('Get schedules error:', error);
    res.status(500).json({ message: 'Failed to fetch schedules' });
  }
});

// Get schedules for specific workflow
router.get(
  '/workflow/:workflowId',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const user = req.user as User;
      const { workflowId } = req.params;

      const schedules = await prisma.workflowSchedule.findMany({
        where: {
          workflowId,
          workflow: {
            userId: user.id,
          },
        },
        include: {
          workflow: true,
        },
      });

      res.json({ schedules });
    } catch (error) {
      console.error('Get schedules error:', error);
      res.status(500).json({ message: 'Failed to fetch schedules' });
    }
  }
);

// Get single schedule
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;

    const schedule = await prisma.workflowSchedule.findFirst({
      where: {
        id,
        workflow: {
          userId: user.id,
        },
      },
      include: {
        workflow: true,
      },
    });

    if (!schedule) {
      return res.status(404).json({ message: 'Schedule not found' });
    }

    res.json({ schedule });
  } catch (error) {
    console.error('Get schedule error:', error);
    res.status(500).json({ message: 'Failed to fetch schedule' });
  }
});

// Update schedule
router.put('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;
    const { cronExpression, timezone, isActive } = req.body;

    // Verify ownership
    const existingSchedule = await prisma.workflowSchedule.findFirst({
      where: {
        id,
        workflow: {
          userId: user.id,
        },
      },
    });

    if (!existingSchedule) {
      return res.status(404).json({ message: 'Schedule not found' });
    }

    // Calculate next run if cron expression changed
    let nextRun = existingSchedule.nextRun;
    if (cronExpression && cronExpression !== existingSchedule.cronExpression) {
      const interval = CronExpressionParser.parse(cronExpression, {
        tz: timezone || existingSchedule.timezone,
      });
      nextRun = interval.next().toDate();
    }

    const schedule = await prisma.workflowSchedule.update({
      where: { id },
      data: {
        cronExpression: cronExpression || existingSchedule.cronExpression,
        timezone: timezone || existingSchedule.timezone,
        isActive: isActive !== undefined ? isActive : existingSchedule.isActive,
        nextRun,
        updatedAt: new Date(),
      },
    });

    res.json({ schedule });
  } catch (error) {
    console.error('Update schedule error:', error);
    res.status(500).json({ message: 'Failed to update schedule' });
  }
});

// Toggle schedule active status
router.patch('/:id/toggle', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;

    const schedule = await prisma.workflowSchedule.findFirst({
      where: {
        id,
        workflow: {
          userId: user.id,
        },
      },
    });

    if (!schedule) {
      return res.status(404).json({ message: 'Schedule not found' });
    }

    const updated = await prisma.workflowSchedule.update({
      where: { id },
      data: {
        isActive: !schedule.isActive,
        updatedAt: new Date(),
      },
    });

    res.json({ schedule: updated });
  } catch (error) {
    console.error('Toggle schedule error:', error);
    res.status(500).json({ message: 'Failed to toggle schedule' });
  }
});

// Delete schedule
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;

    const result = await prisma.workflowSchedule.deleteMany({
      where: {
        id,
        workflow: {
          userId: user.id,
        },
      },
    });

    if (result.count === 0) {
      return res.status(404).json({ message: 'Schedule not found' });
    }

    res.json({ message: 'Schedule deleted successfully' });
  } catch (error) {
    console.error('Delete schedule error:', error);
    res.status(500).json({ message: 'Failed to delete schedule' });
  }
});

export default router;
