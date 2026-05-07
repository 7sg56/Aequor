/**
 * Agent barrel export + verification pipeline.
 *
 * Architecture: Argus is the master agent that internally spawns
 * Themis, Dike, and Chronos as audit streams. Kratos then consumes
 * all reports for consensus. Plutus handles payment. Nemesis handles disputes.
 */

export { runArgus } from './argus/index.js';
export { runKratos } from './kratos/index.js';
export { runNemesis } from './nemesis/index.js';
export { runPlutus } from './plutus/index.js';

import { runPlutus } from './plutus/index.js';
import { createLogger } from '../utils/logger.js';
import { emitAgentEvent } from '../events/emitter.js';
import { prisma } from '../db/index.js';
import { TaskCacheService } from '../services/taskCache.js';

const log = createLogger('pipeline');

/**
 * Full verification pipeline:
 *   Argus (fetches evidence + runs Themis/Dike/Chronos audit streams)
 *   -> Kratos (consensus from all reports)
 *   -> Plutus (payment if approved)
 */
export async function runVerificationPipeline(taskId: string): Promise<{
  score: number;
  decision: string;
}> {
  log.info('Verification pipeline started', { taskId });

  emitAgentEvent({
    type: 'pipeline_start',
    taskId,
    agent: 'PIPELINE',
    message: 'Verification pipeline initiated',
  });

  const pipelinePromise = (async () => {
    // Phase 1-4: Argus handles evidence + all audit streams internally
    emitAgentEvent({ type: 'agent_start', taskId, agent: 'ARGUS', message: 'Argus activated — fetching GitHub evidence & running audit streams' });
    await runArgus(taskId);
    emitAgentEvent({ type: 'agent_complete', taskId, agent: 'ARGUS', message: 'Argus finished — evidence collected, all audit streams complete' });

    // Phase 5: Kratos computes consensus from all filed reports
    emitAgentEvent({ type: 'agent_start', taskId, agent: 'KRATOS', message: 'Kratos activated — computing consensus score' });
    const consensus = await runKratos(taskId);
    emitAgentEvent({
      type: 'agent_complete',
      taskId,
      agent: 'KRATOS',
      message: `Consensus reached: ${consensus.finalScore}/100 — ${consensus.decision.replace('_', ' ')}`,
      data: { score: consensus.finalScore, decision: consensus.decision },
    });

    // Phase 6: Plutus handles payment if auto-released
    if (consensus.decision === 'AUTO_RELEASE') {
      emitAgentEvent({ type: 'agent_start', taskId, agent: 'PLUTUS', message: 'Plutus activated — streaming payment on Solana' });
      await runPlutus(taskId);
      emitAgentEvent({ type: 'agent_complete', taskId, agent: 'PLUTUS', message: 'Payment streamed successfully' });
    } else {
      emitAgentEvent({
        type: 'agent_complete',
        taskId,
        agent: 'PLUTUS',
        message: `Payment not auto-released (decision: ${consensus.decision})`,
      });
    }

    // PHASE 7: FINALIZATION — Persist all buffered data from Redis to PostgreSQL
    log.info('Finalizing results in DB', { taskId });
    
    const evidence = await TaskCacheService.getBufferedEvidence(taskId);
    const reports = await TaskCacheService.getBufferedReports(taskId);

    // 1. Update task results
    await prisma.task.update({
      where: { id: taskId },
      data: {
        score: consensus.finalScore,
        decision: consensus.decision as any,
        status: consensus.decision === 'AUTO_RELEASE' ? 'APPROVED' : consensus.decision === 'HOLD' ? 'REVISION_REQUESTED' : 'REVIEWING',
      },
    });

    // 2. Persist reports
    if (reports.length > 0) {
      await prisma.agentReport.createMany({
        data: reports.map(r => ({
          ...r,
          details: r.details || {},
        })),
      });
    }

    // 3. Persist Kratos final report (not explicitly buffered in Kratos anymore)
    await prisma.agentReport.create({
      data: {
        taskId,
        agentName: 'KRATOS',
        score: consensus.finalScore,
        confidence: reports.length >= 3 ? 0.9 : 0.6,
        severity: consensus.decision === 'HOLD' ? 'HIGH' : consensus.decision === 'MANUAL_REVIEW' ? 'MEDIUM' : 'INFO',
        summary: consensus.summary,
        reasoning: JSON.stringify(consensus),
        details: consensus as any,
        recommendations: consensus.recommendations,
      },
    });

    // 4. Update evidence on the latest submission
    const latestSub = await prisma.submission.findFirst({
      where: { taskId },
      orderBy: { submittedAt: 'desc' },
    });
    if (latestSub && evidence) {
      await prisma.submission.update({
        where: { id: latestSub.id },
        data: { evidence: evidence as any },
      });
    }

    // 5. Audit log
    await prisma.auditLog.create({
      data: {
        action: 'pipeline_finalized',
        actor: 'SYSTEM',
        target: taskId,
        details: { score: consensus.finalScore, decision: consensus.decision } as any,
      },
    });

    // 6. Clear Cache
    await TaskCacheService.clearTask(taskId);

    emitAgentEvent({
      type: 'pipeline_complete',
      taskId,
      agent: 'PIPELINE',
      message: `Pipeline complete — Score: ${consensus.finalScore}/100, Decision: ${consensus.decision}`,
      data: { score: consensus.finalScore, decision: consensus.decision },
    });

    log.info('Pipeline complete', {
      taskId,
      score: consensus.finalScore,
      decision: consensus.decision,
    });

    return { score: consensus.finalScore, decision: consensus.decision };
  })();

  return await Promise.race([
    pipelinePromise,
    new Promise<{ score: number; decision: string }>((_, reject) => 
      setTimeout(() => reject(new Error('Global verification pipeline timeout (3 min)')), 180000)
    )
  ]);
}
