/**
 * Task API routes — create tasks, submit work, trigger verification.
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db/index.js';
import { runVerificationPipeline } from '../../agents/index.js';

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
    return { success: true, data: task };
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
}
