/**
 * KRATOS — Consensus Orchestrator
 * Collects all agent reports, computes weighted consensus score, and makes the final decision.
 */

import { config } from '../../config/index.js';
import { createLogger } from '../../utils/logger.js';
import { prisma } from '../../db/index.js';

const log = createLogger('agent:kratos');

interface ConsensusResult {
  finalScore: number;
  decision: 'AUTO_RELEASE' | 'MANUAL_REVIEW' | 'HOLD' | 'DISPUTED';
  objectiveScore: number;
  aiScore: number;
  agentScores: Record<string, number>;
  summary: string;
  recommendations: string[];
}

const AGENT_WEIGHTS: Record<string, number> = {
  ARGUS: 1.0,    // objective evidence — feeds into objectiveScore
  THEMIS: 0.4,   // spec compliance — AI reasoning
  DIKE: 0.35,    // code quality — AI reasoning
  CHRONOS: 0.25, // timeliness — AI reasoning
};

export function computeConsensus(
  agentScores: Record<string, number>,
): ConsensusResult {
  const objectiveScore = agentScores['ARGUS'] ?? 0;

  // Weighted AI score from auditors
  const aiAgents = ['THEMIS', 'DIKE', 'CHRONOS'];
  let aiWeightSum = 0;
  let aiScoreSum = 0;
  for (const agent of aiAgents) {
    const score = agentScores[agent];
    const weight = AGENT_WEIGHTS[agent] ?? 0;
    if (score !== undefined) {
      aiScoreSum += score * weight;
      aiWeightSum += weight;
    }
  }
  const aiScore = aiWeightSum > 0 ? aiScoreSum / aiWeightSum : 0;

  // Final weighted score: 40% objective + 60% AI reasoning
  const finalScore = Math.round(
    objectiveScore * config.scoring.objectiveWeight +
    aiScore * config.scoring.aiReasoningWeight
  );

  // Decision
  let decision: ConsensusResult['decision'];
  if (finalScore >= config.scoring.autoReleaseThreshold) {
    decision = 'AUTO_RELEASE';
  } else if (finalScore >= config.scoring.reviewThreshold) {
    decision = 'MANUAL_REVIEW';
  } else {
    decision = 'HOLD';
  }

  const recommendations: string[] = [];
  if (decision === 'AUTO_RELEASE') {
    recommendations.push('Score meets threshold — auto-release payment via Plutus');
  } else if (decision === 'MANUAL_REVIEW') {
    recommendations.push('Score in review range — client should manually verify');
    if ((agentScores['DIKE'] ?? 100) < 60) recommendations.push('Code quality flagged by Dike');
    if ((agentScores['THEMIS'] ?? 100) < 60) recommendations.push('Spec compliance flagged by Themis');
  } else {
    recommendations.push('Score below threshold — payment held pending revision');
  }

  return {
    finalScore,
    decision,
    objectiveScore,
    aiScore: Math.round(aiScore),
    agentScores,
    summary: `Consensus: ${finalScore}/100 — ${decision.replace('_', ' ')}`,
    recommendations,
  };
}

export async function runKratos(taskId: string): Promise<ConsensusResult> {
  log.info('Kratos activated', { taskId });

  const reports = await prisma.agentReport.findMany({
    where: { taskId, agentName: { in: ['ARGUS', 'THEMIS', 'DIKE', 'CHRONOS'] } },
    orderBy: { createdAt: 'desc' },
  });

  // Take latest report per agent
  const latestByAgent: Record<string, number> = {};
  for (const r of reports) {
    if (!(r.agentName in latestByAgent)) {
      latestByAgent[r.agentName] = r.score;
    }
  }

  const consensus = computeConsensus(latestByAgent);

  // File Kratos report
  await prisma.agentReport.create({
    data: {
      taskId,
      agentName: 'KRATOS',
      score: consensus.finalScore,
      confidence: Object.keys(latestByAgent).length >= 3 ? 0.9 : 0.6,
      severity: consensus.decision === 'HOLD' ? 'HIGH' : consensus.decision === 'MANUAL_REVIEW' ? 'MEDIUM' : 'INFO',
      summary: consensus.summary,
      reasoning: JSON.stringify(consensus),
      details: consensus as any,
      recommendations: consensus.recommendations,
    },
  });

  // Update task with score and decision
  await prisma.task.update({
    where: { id: taskId },
    data: {
      score: consensus.finalScore,
      decision: consensus.decision,
      status: consensus.decision === 'AUTO_RELEASE' ? 'APPROVED' : consensus.decision === 'HOLD' ? 'REVISION_REQUESTED' : 'REVIEWING',
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      action: 'consensus_reached',
      actor: 'KRATOS',
      target: taskId,
      details: { score: consensus.finalScore, decision: consensus.decision } as any,
    },
  });

  log.info('Kratos consensus', { taskId, score: consensus.finalScore, decision: consensus.decision });
  return consensus;
}
