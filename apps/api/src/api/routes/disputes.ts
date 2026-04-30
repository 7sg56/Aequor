/**
 * Dispute API routes.
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db/index.js';
import { runNemesis } from '../../agents/nemesis/index.js';

const CreateDisputeSchema = z.object({
  reason: z.string().min(10),
  raisedBy: z.string().min(32),
  evidence: z.record(z.unknown()).optional(),
});

export async function disputeRoutes(app: FastifyInstance) {
  // Create dispute
  app.post('/api/tasks/:id/dispute', async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = CreateDisputeSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: parsed.error.message } });
    }

    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } });

    const dispute = await prisma.dispute.create({
      data: { taskId: id, ...parsed.data },
    });

    await prisma.task.update({ where: { id }, data: { status: 'DISPUTED', decision: 'DISPUTED' } });

    // Auto-trigger Nemesis
    await runNemesis(id, dispute.id);

    return reply.status(201).send({ success: true, data: dispute });
  });

  // List disputes
  app.get('/api/disputes', async (req) => {
    const { status } = req.query as Record<string, string>;
    const where: any = {};
    if (status) where.status = status;
    const disputes = await prisma.dispute.findMany({
      where, orderBy: { createdAt: 'desc' }, include: { task: true },
    });
    return { success: true, data: disputes };
  });
}
