/**
 * Task API routes — create tasks, submit work, trigger verification.
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db/index.js';
import { runVerificationPipeline } from '../../agents/index.js';
import { TaskCacheService } from '../../services/taskCache.js';

const CreateTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  repoUrl: z.string().url().optional(),
  branch: z.string().default('main'),
  specs: z.record(z.unknown()),
  escrowAmount: z.number().positive(),
  clientWallet: z.string().min(32),
});

const SubmitWorkSchema = z.object({
  repoUrl: z.string().url(),
  branch: z.string().default('main'),
  commitHash: z.string().optional(),
  prUrl: z.string().url().optional(),
  notes: z.string().optional(),
  workerWallet: z.string().min(32),
});

export async function taskRoutes(app: FastifyInstance) {
  // List tasks
  app.get('/api/tasks', async (req, reply) => {
    const { status, wallet, limit, offset } = req.query as Record<string, string>;
    const where: any = {};
    if (status) where.status = status;
    if (wallet) where.OR = [{ clientWallet: wallet }, { workerWallet: wallet }];

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit ?? '20'),
        skip: parseInt(offset ?? '0'),
        include: { _count: { select: { agentReports: true, submissions: true } } },
      }),
      prisma.task.count({ where }),
    ]);

    return { success: true, data: tasks, meta: { total, timestamp: Date.now() } };
  });

  // Get single task with reports
  app.get('/api/tasks/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        submissions: true,
        agentReports: { orderBy: { createdAt: 'desc' } },
        payments: true,
        disputes: true,
      },
    });
    if (!task) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } });

    // If task is in progress, merge buffered reports from Redis
    if (task.status === 'REVIEWING') {
      const bufferedReports = await TaskCacheService.getBufferedReports(id);
      if (bufferedReports.length > 0) {
        // Filter out any reports that might already exist in DB (unlikely but safe)
        const dbAgentNames = new Set(task.agentReports.map(r => r.agentName));
        const missingReports = bufferedReports.filter(r => !dbAgentNames.has(r.agentName));
        (task as any).agentReports = [...task.agentReports, ...missingReports];
      }
    }

    return { success: true, data: task };
  });

  // Get historical events from Redis
  app.get('/api/tasks/:id/events', async (req, reply) => {
    const { id } = req.params as { id: string };
    const events = await TaskCacheService.getEvents(id);
    return { success: true, data: events };
  });

  // Create task
  app.post('/api/tasks', async (req, reply) => {
    const parsed = CreateTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: parsed.error.message } });
    }

    const { specs, ...rest } = parsed.data;
    const task = await prisma.task.create({ data: { ...rest, specs: specs as any } });
    await prisma.auditLog.create({
      data: { action: 'task_created', actor: parsed.data.clientWallet, target: task.id },
    });

    return reply.status(201).send({ success: true, data: task });
  });

  // Submit work
  app.post('/api/tasks/:id/submit', async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = SubmitWorkSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: parsed.error.message } });
    }

    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } });

    // Assign worker and update status
    await prisma.task.update({
      where: { id },
      data: { workerWallet: parsed.data.workerWallet, status: 'SUBMITTED' },
    });

    const submission = await prisma.submission.create({
      data: {
        taskId: id,
        repoUrl: parsed.data.repoUrl,
        branch: parsed.data.branch,
        commitHash: parsed.data.commitHash,
        prUrl: parsed.data.prUrl,
        notes: parsed.data.notes,
      },
    });

    return reply.status(201).send({ success: true, data: submission });
  });

  // Trigger verification pipeline
  app.post('/api/tasks/:id/verify', async (req, reply) => {
    const { id } = req.params as { id: string };
    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } });

    await prisma.task.update({ where: { id }, data: { status: 'REVIEWING' } });

    // Run pipeline (in production, enqueue via BullMQ)
    const result = await runVerificationPipeline(id);

    return { success: true, data: result };
  });

  // ── Quick Verify (one-click GitHub URL flow) ────────────────────────────────
  // This is the main user-facing endpoint: paste a GitHub URL, everything runs.

  const QuickVerifySchema = z.object({
    repoUrl: z.string().url(),
    branch: z.string().default('main'),
    title: z.string().optional(),
    description: z.string().optional(),
    specs: z.record(z.unknown()).optional(),
  });

  app.post('/api/tasks/quick-verify', async (req, reply) => {
    const parsed = QuickVerifySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: parsed.error.message } });
    }

    const { repoUrl, branch, title, description, specs } = parsed.data;

    // Extract repo name for auto-title
    const repoMatch = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    const autoTitle = repoMatch ? `Verify: ${repoMatch[1]}/${repoMatch[2]}` : `Verify: ${repoUrl}`;

    // Auto-create task
    const task = await prisma.task.create({
      data: {
        title: title || autoTitle,
        description: description || `Automated verification of ${repoUrl}`,
        repoUrl,
        branch,
        specs: (specs || { requirement: 'General code audit and quality check' }) as any,
        escrowAmount: 0, // Quick verify doesn't require escrow
        clientWallet: 'system-quick-verify',
        status: 'SUBMITTED',
      },
    });

    // Auto-create submission
    await prisma.submission.create({
      data: {
        taskId: task.id,
        repoUrl,
        branch,
        notes: 'Auto-created via quick-verify',
      },
    });

    // Log it
    await prisma.auditLog.create({
      data: {
        action: 'quick_verify_started',
        actor: 'SYSTEM',
        target: task.id,
        details: { repoUrl, branch } as any,
      },
    });

    // Update status and run pipeline async (don't block the response)
    await prisma.task.update({ where: { id: task.id }, data: { status: 'REVIEWING' } });

    // Fire pipeline in background — events will stream via WebSocket
    runVerificationPipeline(task.id).catch((err) => {
      console.error('Pipeline error:', err);
    });

    return reply.status(201).send({
      success: true,
      data: {
        taskId: task.id,
        title: task.title,
        repoUrl,
        branch,
        status: 'REVIEWING',
        message: 'Verification pipeline started. Connect to WebSocket at /ws/events for real-time updates.',
      },
    });
  });
}
