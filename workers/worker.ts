// workers/worker.ts
import Queue, { Job } from 'bull';
import { PrismaClient } from '@prisma/client';
import WorkflowExecutor from '@/services/workflow-executor.service.js';
import cron from 'node-cron';
import { CronExpressionParser } from 'cron-parser';

const prisma = new PrismaClient();
const executor = new WorkflowExecutor();

// Use `any` for job data to avoid implicit any errors in strict TS mode.
// You can later tighten this with proper interfaces if you want.
export const workflowQueue = new Queue<any>('workflow-execution', {
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? '6379'),
  },
});

workflowQueue.process('execute', async (job: Job) => {
  const {
    workflowId,
    userId,
    nodes,
    edges,
  } = job.data as {
    workflowId: string;
    userId: string;
    nodes: any[];
    edges: any[];
  };

  console.log(`[Worker] Processing workflow ${workflowId}`);

  try {
    const result = await executor.executeWorkflow(
      workflowId,
      nodes,
      edges,
      userId
    );
    console.log(`[Worker] Workflow ${workflowId} completed successfully`);
    return result;
  } catch (error: any) {
    console.error(
      `[Worker] Workflow ${workflowId} failed:`,
      error?.message ?? error
    );
    throw error;
  }
});

// Run every minute to check for scheduled workflows
cron.schedule('* * * * *', async () => {
  console.log('[Scheduler] Checking scheduled workflows...');

  try {
    const now = new Date();
    const schedulesToRun = await prisma.workflowSchedule.findMany({
      where: {
        isActive: true,
        nextRun: { lte: now },
      },
      include: { workflow: true },
    });

    for (const schedule of schedulesToRun) {
      const workflow = schedule.workflow;
      const workflowData = workflow.workflowData as any;

      console.log(`[Scheduler] Triggering workflow: ${workflow.name}`);

      await workflowQueue.add('execute', {
        workflowId: workflow.id,
        userId: workflow.userId,
        nodes: workflowData.nodes,
        edges: workflowData.edges,
      });

      // Calculate next run time
      try {
        const interval = CronExpressionParser.parse(schedule.cronExpression, {
          tz: schedule.timezone || 'UTC',
        });
        const nextRun = interval.next().toDate();

        await prisma.workflowSchedule.update({
          where: { id: schedule.id },
          data: { lastRun: now, nextRun },
        });
      } catch (cronError) {
        console.error(
          `[Scheduler] Invalid cron expression for schedule ${schedule.id}:`,
          cronError
        );
      }
    }

    if (schedulesToRun.length > 0) {
      console.log(`[Scheduler] Triggered ${schedulesToRun.length} workflows`);
    }
  } catch (error) {
    console.error('[Scheduler] Error checking schedules:', error);
  }
});

// Process webhook triggers
workflowQueue.process('webhook', async (job: Job) => {
  const { webhookId, payload } = job.data as { webhookId: string; payload: any };
  console.log(`[Worker] Processing webhook ${webhookId}`);

  let workflowExecutionId: string | undefined;

  try {
    await prisma.webhookRequest.update({
      where: { id: webhookId },
      data: { status: 'PROCESSING' },
    });

    const webhook = await prisma.webhook.findUnique({
      where: { id: webhookId },
    });

    if (!webhook || !webhook.workflowId) {
      throw new Error('Webhook not found or not linked to workflow');
    }

    const workflow = await prisma.workflow.findUnique({
      where: { id: webhook.workflowId },
    });

    if (!workflow || !workflow.isActive) {
      throw new Error('Workflow not found or inactive');
    }

    const workflowData = workflow.workflowData as any;

    const executionResult = await executor.executeWorkflow(
      workflow.id,
      workflowData.nodes,
      workflowData.edges,
      workflow.userId,
      payload // Pass the webhook payload as initial data
    );
    workflowExecutionId = executionResult.executionId;

    await prisma.webhookRequest.update({
      where: { id: webhookId },
      data: {
        status: 'COMPLETED',
        workflowExecutionId: workflowExecutionId,
        response: executionResult,
      },
    });

    return { success: true, workflowExecutionId };
  } catch (error: any) {
    console.error(
      `[Worker] Webhook processing failed:`,
      error?.message ?? error
    );

    await prisma.webhookRequest.update({
      where: { id: webhookId },
      data: {
        status: 'FAILED',
        error: error?.message ?? 'Unknown error',
        workflowExecutionId: workflowExecutionId,
      },
    });
    throw error;
  }
});

// Event listeners
workflowQueue.on('completed', (job: Job, result: any) => {
  console.log(`[Queue] Job ${job.id} completed:`, result);
});

workflowQueue.on('failed', (job: Job | null, err: Error) => {
  console.error(
    `[Queue] Job ${job?.id ?? 'unknown'} failed:`,
    err?.message ?? err
  );
});

console.log('✓ Workflow worker started');
console.log('✓ Scheduler active - checking every minute');
console.log('✓ Queue processor ready');
