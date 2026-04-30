/**
 * NEMESIS — Dispute Arbiter
 * Activated when client/worker disagree. Reviews audit trail and recommends resolution.
 */

import Groq from 'groq-sdk';
import { config } from '../../config/index.js';
import { createLogger } from '../../utils/logger.js';
import { prisma } from '../../db/index.js';

const log = createLogger('agent:nemesis');
const groq = new Groq({ apiKey: config.groq.apiKey || undefined });

export async function runNemesis(taskId: string, disputeId: string): Promise<void> {
  log.info('Nemesis activated', { taskId, disputeId });

  const [dispute, reports] = await Promise.all([
    prisma.dispute.findUnique({ where: { id: disputeId } }),
    prisma.agentReport.findMany({ where: { taskId }, orderBy: { createdAt: 'desc' } }),
  ]);

  if (!dispute) { log.warn('Dispute not found', { disputeId }); return; }

  // Build context from all prior agent reports
  const auditTrail = reports.map(r => ({
    agent: r.agentName, score: r.score, summary: r.summary,
    recommendations: r.recommendations,
  }));

  let resolution: string;
  let resolvedFor: 'RESOLVED_FOR_CLIENT' | 'RESOLVED_FOR_WORKER' | 'ESCALATED';

  try {
    const resp = await groq.chat.completions.create({
      model: config.groq.model,
      messages: [
        { role: 'system', content: 'You are Nemesis, a fair dispute arbiter. Respond in JSON with { "resolution": "<explanation>", "favor": "client" | "worker" | "escalate", "confidence": <0-1> }' },
        { role: 'user', content: `Dispute reason: ${dispute.reason}\n\nAudit trail:\n${JSON.stringify(auditTrail, null, 2)}` },
      ],
      temperature: 0.3, max_tokens: 1024,
      response_format: { type: 'json_object' },
    });

    const content = resp.choices[0]?.message?.content;
    const parsed = content ? JSON.parse(content) : null;
    resolution = parsed?.resolution ?? 'Unable to determine';
    resolvedFor = parsed?.favor === 'client' ? 'RESOLVED_FOR_CLIENT'
      : parsed?.favor === 'worker' ? 'RESOLVED_FOR_WORKER' : 'ESCALATED';
  } catch {
    // Heuristic fallback: side with higher consensus score
    const kratosReport = reports.find(r => r.agentName === 'KRATOS');
    const score = kratosReport?.score ?? 50;
    resolvedFor = score >= 70 ? 'RESOLVED_FOR_WORKER' : score < 40 ? 'RESOLVED_FOR_CLIENT' : 'ESCALATED';
    resolution = `Heuristic: consensus score ${score} => ${resolvedFor}`;
  }

  await prisma.dispute.update({
    where: { id: disputeId },
    data: { status: resolvedFor, resolution, resolvedBy: 'NEMESIS', resolvedAt: new Date() },
  });

  await prisma.agentReport.create({
    data: {
      taskId, agentName: 'NEMESIS', score: 0, confidence: 0.7,
      severity: 'HIGH', summary: `Dispute resolved: ${resolvedFor}`,
      reasoning: resolution, details: { disputeId, auditTrail } as any,
      recommendations: [resolvedFor === 'ESCALATED' ? 'Requires human review' : 'Dispute resolved by AI arbiter'],
    },
  });

  log.info('Nemesis resolved dispute', { disputeId, resolvedFor });
}
