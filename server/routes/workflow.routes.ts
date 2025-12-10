// server/routes/workflow.routes.ts
import { Router, Request, Response } from 'express';
import { PrismaClient, User } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { WorkflowExecutor } from '../services/workflow-executor.service.js';
import redis from '../lib/redis.js';

const prisma = new PrismaClient();
const router = Router();
const executor = new WorkflowExecutor();

// Get all workflows for user
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const skip = (page - 1) * pageSize;

    const [workflows, totalWorkflows] = await prisma.$transaction([
      prisma.workflow.findMany({
        where: { userId: user.id },
        include: {
          schedules: true,
          executions: {
            orderBy: { startedAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.workflow.count({
        where: { userId: user.id },
      }),
    ]);

    res.json({
      workflows,
      pagination: {
        total: totalWorkflows,
        page,
        pageSize,
        totalPages: Math.ceil(totalWorkflows / pageSize),
      },
    });
  } catch (error) {
    console.error('Get workflows error:', error);
    res.status(500).json({ message: 'Failed to fetch workflows' });
  }
});

// Get workflow templates
router.get('/templates', async (_req: Request, res: Response) => {
  try {
    const templates = await prisma.workflow.findMany({
      where: { isTemplate: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ templates });
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({ message: 'Failed to fetch templates' });
  }
});

// Create workflow
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { name, description, workflowData, category } = req.body;

    const workflow = await prisma.workflow.create({
      data: {
        userId: user.id,
        name,
        description: description || '',
        workflowData,
        category: category || 'general',
        isActive: true,
      },
    });

    res.status(201).json({ workflow });
  } catch (error) {
    console.error('Create workflow error:', error);
    res.status(500).json({ message: 'Failed to create workflow' });
  }
});

// Update workflow
router.put('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;
    const { name, description, workflowData, isActive } = req.body;

    const workflow = await prisma.workflow.update({
      where: {
        id,
        userId: user.id,
      },
      data: {
        name: name || undefined,
        description: description || undefined,
        workflowData: workflowData || undefined,
        isActive: isActive !== undefined ? isActive : undefined,
        updatedAt: new Date(),
      },
    });

    res.json({ workflow });
  } catch (error) {
    console.error('Update workflow error:', error);
    res.status(500).json({ message: 'Failed to update workflow' });
  }
});

// Delete workflow
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;

    await prisma.workflow.delete({
      where: {
        id,
        userId: user.id,
      },
    });

    res.json({ message: 'Workflow deleted successfully' });
  } catch (error) {
    console.error('Delete workflow error:', error);
    res.status(500).json({ message: 'Failed to delete workflow' });
  }
});

// Execute workflow (run once / schedule trigger entry point)
router.post('/:id/execute', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user as User;
    const { id } = req.params;
    const { nodes, edges } = req.body;

    const cacheKey = `workflow:${id}:${user.id}`;
    let workflow = null;

    // Try to get from cache
    const cachedWorkflow = await redis.get(cacheKey);
    if (cachedWorkflow) {
      workflow = JSON.parse(cachedWorkflow);
    } else {
      // If not in cache, fetch from DB and store in cache
      workflow = await prisma.workflow.findFirst({
        where: { id, userId: user.id },
      });
      if (workflow) {
        await redis.set(cacheKey, JSON.stringify(workflow), 'EX', 3600); // Cache for 1 hour
      }
    }

    if (!workflow) {
      return res.status(404).json({ message: 'Workflow not found' });
    }

    const graphNodes = nodes ?? (workflow.workflowData as any)?.nodes ?? [];
    const graphEdges = edges ?? (workflow.workflowData as any)?.edges ?? [];

    if (!Array.isArray(graphNodes) || graphNodes.length === 0) {
      return res.status(400).json({ message: 'Workflow has no nodes to execute' });
    }

    const result = await executor.executeWorkflow(
      workflow.id,
      graphNodes,
      graphEdges,
      user.id
    );

    res.json({ success: true, executionId: result.executionId });
  } catch (error: any) {
    console.error('Execute workflow error:', error);
    res.status(500).json({ message: error.message || 'Failed to execute workflow' });
  }
});

export default router;
