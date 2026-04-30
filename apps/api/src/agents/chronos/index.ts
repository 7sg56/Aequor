/**
 * CHRONOS — Timeliness Auditor
 * Evaluates submission timelines, commit cadence, and deadline adherence.
 */

import { createLogger } from '../../utils/logger.js';
import { prisma } from '../../db/index.js';

const log = createLogger('agent:chronos');

export function analyzeTimeliness(
  taskCreated: Date,
  submissionDate: Date,
  deadline: Date | null,
  commitDates: Date[],
) {
  const taskAge = (submissionDate.getTime() - taskCreated.getTime()) / 86400000;
  let onTime = true;
  let daysRemaining = 0;

  if (deadline) {
    daysRemaining = Math.floor((deadline.getTime() - submissionDate.getTime()) / 86400000);
    onTime = daysRemaining >= 0;
  }

  const sorted = [...commitDates].sort((a, b) => a.getTime() - b.getTime());
  let cadence: 'steady' | 'burst' | 'last_minute' | 'none' = 'none';
  if (sorted.length > 0) {
    const duration = sorted[sorted.length - 1]!.getTime() - taskCreated.getTime();
    if (duration === 0) { cadence = 'burst'; }
    else {
      const cutoff = taskCreated.getTime() + duration * 0.8;
      const lateRatio = sorted.filter(d => d.getTime() > cutoff).length / sorted.length;
      cadence = lateRatio > 0.7 ? 'last_minute' : lateRatio > 0.5 ? 'burst' : 'steady';
    }
  }

  let score = 50;
  if (deadline) { score += onTime ? 20 + (daysRemaining > 2 ? 10 : 0) : -30; }
  else { score += 10; }
  score += cadence === 'steady' ? 20 : cadence === 'burst' ? 5 : cadence === 'last_minute' ? -10 : -20;
  score = Math.max(0, Math.min(100, score));

  const uniqueDays = new Set(commitDates.map(d => d.toISOString().split('T')[0])).size;
  return {
    score, onTime, daysRemaining, commitCadence: cadence,
    avgCommitsPerDay: Math.round((commitDates.length / Math.max(taskAge, 1)) * 100) / 100,
    totalWorkDays: uniqueDays,
    summary: onTime
      ? `On time, ${cadence} cadence, ${uniqueDays} active days.`
      : `Late by ${Math.abs(daysRemaining)} days, ${cadence} cadence.`,
  };
}

export async function runChronos(taskId: string): Promise<void> {
  log.info('Chronos activated', { taskId });
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { submissions: { orderBy: { submittedAt: 'desc' }, take: 1 } },
  });
  if (!task || !task.submissions[0]) return;

  const sub = task.submissions[0];
  const evidence = (sub.evidence ?? {}) as any;
  const commitDates = (evidence.commits ?? []).map((c: any) => new Date(c.date));
  const specs = task.specs as Record<string, unknown>;
  const deadline = specs['deadline'] ? new Date(specs['deadline'] as string) : null;

  const analysis = analyzeTimeliness(task.createdAt, sub.submittedAt, deadline, commitDates);

  await prisma.agentReport.create({
    data: {
      taskId, agentName: 'CHRONOS', score: analysis.score, confidence: 0.95,
      severity: analysis.onTime ? 'INFO' : 'MEDIUM', summary: analysis.summary,
      reasoning: JSON.stringify(analysis), details: analysis as any,
      recommendations: !analysis.onTime ? ['Late submission'] : ['On time'],
    },
  });
  log.info('Chronos report filed', { taskId, score: analysis.score });
}
