/**
 * Dashboard / stats API routes.
 */

import { FastifyInstance } from 'fastify';
import { prisma } from '../../db/index.js';

export async function dashboardRoutes(app: FastifyInstance) {
  app.get('/api/dashboard/stats', async () => {
    const [
      totalTasks,
      activeTasks,
      completedTasks,
      disputedTasks,
      totalPayments,
      recentReports,
    ] = await Promise.all([
      prisma.task.count(),
      prisma.task.count({ where: { status: { in: ['ASSIGNED', 'SUBMITTED', 'REVIEWING'] } } }),
      prisma.task.count({ where: { status: 'COMPLETED' } }),
      prisma.task.count({ where: { status: 'DISPUTED' } }),
      prisma.payment.aggregate({ _sum: { amount: true } }),
      prisma.agentReport.count({ where: { severity: { in: ['HIGH', 'CRITICAL'] } } }),
    ]);

    const total = totalTasks || 1;

    return {
      success: true,
      data: {
        totalTasks,
        activeTasks,
        completedTasks,
        disputeRate: Math.round((disputedTasks / total) * 100) / 100,
        totalVolume: totalPayments._sum.amount ?? 0,
        agentAlerts: recentReports,
      },
    };
  });

  app.get('/api/dashboard/recent-activity', async () => {
    const [recentTasks, recentReports] = await Promise.all([
      prisma.task.findMany({ orderBy: { updatedAt: 'desc' }, take: 10 }),
      prisma.agentReport.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }),
    ]);
    return { success: true, data: { recentTasks, recentReports } };
  });

  app.get('/api/audit-log', async (req) => {
    const { limit, action } = req.query as Record<string, string>;
    const where: any = {};
    if (action) where.action = action;
    const entries = await prisma.auditLog.findMany({
      where, orderBy: { createdAt: 'desc' }, take: parseInt(limit ?? '50'),
    });
    return { success: true, data: entries };
  });
}
