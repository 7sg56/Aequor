/**
 * KRATOS — Consensus Orchestrator
 * Collects all agent reports, computes weighted consensus score, and makes the final decision.
 */

import { config } from '../../config/index.js';
import { createLogger } from '../../utils/logger.js';
import { prisma } from '../../db/index.js';
import { TaskCacheService } from '../../services/taskCache.js';

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

  const reports = await TaskCacheService.getBufferedReports(taskId);

  // Take latest report per agent
  const latestByAgent: Record<string, number> = {};
  for (const r of reports) {
    if (!(r.agentName in latestByAgent)) {
      latestByAgent[r.agentName] = r.score;
    }
  }

  const consensus = computeConsensus(latestByAgent);

  log.info('Kratos consensus computed (cached)', { taskId, score: consensus.finalScore, decision: consensus.decision });
  return consensus;
}
