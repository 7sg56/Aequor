/**
 * THEMIS — Spec Compliance Auditor
 *
 * Named after the goddess of divine law and order.
 * Uses Groq LLM to evaluate whether submitted work matches task specifications.
 */

import Groq from 'groq-sdk';
import { config } from '../../config/index.js';
import { createLogger } from '../../utils/logger.js';
import { prisma } from '../../db/index.js';

const log = createLogger('agent:themis');

const groq = new Groq({ apiKey: config.groq.apiKey || undefined });

// ── Prompts ──────────────────────────────────────────────────────────────────

function buildCompliancePrompt(specs: Record<string, unknown>, evidence: Record<string, unknown>): string {
  return `You are Themis, an AI auditor specializing in specification compliance.

TASK SPECIFICATIONS:
${JSON.stringify(specs, null, 2)}

SUBMITTED EVIDENCE (GitHub activity):
${JSON.stringify(evidence, null, 2)}

Evaluate whether the submitted work meets the task specifications. For each requirement in the specs, determine if it was:
- FULLY MET: Clear evidence of completion
- PARTIALLY MET: Some work done but incomplete
- NOT MET: No evidence of this requirement being addressed

Respond in JSON format:
{
  "overallScore": <number 0-100>,
  "requirements": [
    {
      "requirement": "<description>",
      "status": "FULLY_MET" | "PARTIALLY_MET" | "NOT_MET",
      "evidence": "<what you found>",
      "score": <number 0-100>
    }
  ],
  "summary": "<1-2 sentence overall assessment>",
  "recommendations": ["<suggestion 1>", "<suggestion 2>"]
}`;
}

// ── Core Logic ───────────────────────────────────────────────────────────────

export async function evaluateCompliance(
  specs: Record<string, unknown>,
  evidence: Record<string, unknown>,
): Promise<{
  score: number;
  summary: string;
  reasoning: string;
  recommendations: string[];
}> {
  try {
    const response = await groq.chat.completions.create({
      model: config.groq.model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert code auditor. Respond only in valid JSON.',
        },
        {
          role: 'user',
          content: buildCompliancePrompt(specs, evidence),
        },
      ],
      temperature: 0.2,
      max_tokens: 2048,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Empty LLM response');

    const result = JSON.parse(content);
    return {
      score: result.overallScore ?? 50,
      summary: result.summary ?? 'Unable to generate summary',
      reasoning: content,
      recommendations: result.recommendations ?? [],
    };
  } catch (err) {
    log.warn('LLM call failed, using heuristic fallback', {
      error: err instanceof Error ? err.message : String(err),
    });
    return heuristicFallback(specs, evidence);
  }
}

function heuristicFallback(
  specs: Record<string, unknown>,
  evidence: Record<string, unknown>,
): {
  score: number;
  summary: string;
  reasoning: string;
  recommendations: string[];
} {
  // Simple heuristic: check if evidence has substantial content
  const evidenceKeys = Object.keys(evidence);
  const hasCommits = Array.isArray((evidence as any).commits) && (evidence as any).commits.length > 0;
  const hasFiles = Array.isArray((evidence as any).filesChanged) && (evidence as any).filesChanged.length > 0;

  let score = 40; // base
  if (hasCommits) score += 20;
  if (hasFiles) score += 20;
  if (evidenceKeys.length > 3) score += 10;

  return {
    score: Math.min(score, 100),
    summary: 'Heuristic evaluation (LLM unavailable)',
    reasoning: `Evidence has ${evidenceKeys.length} categories. Commits: ${hasCommits}, Files: ${hasFiles}`,
    recommendations: ['Enable Groq API key for full AI-powered compliance auditing'],
  };
}

// ── Run Agent ────────────────────────────────────────────────────────────────

export async function runThemis(taskId: string): Promise<void> {
  log.info('Themis activated', { taskId });

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      submissions: { orderBy: { submittedAt: 'desc' }, take: 1 },
      agentReports: { where: { agentName: 'ARGUS' }, take: 1 },
    },
  });

  if (!task) {
    log.warn('Task not found', { taskId });
    return;
  }

  const submission = task.submissions[0];
  const argusReport = task.agentReports[0];
  const evidence = (submission?.evidence ?? argusReport?.details ?? {}) as Record<string, unknown>;
  const specs = task.specs as Record<string, unknown>;

  const { score, summary, reasoning, recommendations } = await evaluateCompliance(specs, evidence);

  await prisma.agentReport.create({
    data: {
      taskId,
      agentName: 'THEMIS',
      score,
      confidence: config.groq.apiKey ? 0.85 : 0.5,
      severity: score < 40 ? 'HIGH' : score < 70 ? 'MEDIUM' : 'INFO',
      summary,
      reasoning,
      details: { evidence_summary: evidence } as any,
      recommendations,
    },
  });

  log.info('Themis report filed', { taskId, score });
}
