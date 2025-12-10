import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = Router();
const prisma = new PrismaClient();

// GET /api/executions?limit=10
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const limit = Number(req.query.limit) || 10;

    const executions = await prisma.workflowExecution.findMany({
      where: { userId: user.id },
      orderBy: { startedAt: 'desc' },
      take: limit,
      include: {
        workflow: {
          select: { id: true, name: true },
        },
      },
    });

    res.json({ executions });
  } catch (err) {
    console.error('Get executions error:', err);
    res.status(500).json({ error: 'Failed to fetch executions' });
  }
});

// GET /api/executions/:id/logs
router.get('/:id/logs', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const { id } = req.params;

    const execution = await prisma.workflowExecution.findFirst({
      where: { id, userId: user.id },
    });

    if (!execution) {
      return res.status(404).json({ error: 'Execution not found' });
    }

    const logs = await prisma.executionLog.findMany({
      where: { executionId: id },
      orderBy: { timestamp: 'asc' },
    });

    res.json({ logs });
  } catch (err) {
    console.error('Get execution logs error:', err);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

export default router;
