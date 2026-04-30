/**
 * DIKE — Code Quality Auditor
 *
 * Named after the goddess of justice and fair judgment.
 * Uses Groq LLM to evaluate code quality: structure, readability,
 * best practices, security, and testing.
 */

import Groq from 'groq-sdk';
import { config } from '../../config/index.js';
import { createLogger } from '../../utils/logger.js';
import { prisma } from '../../db/index.js';

const log = createLogger('agent:dike');

const groq = new Groq({ apiKey: config.groq.apiKey || undefined });

// ── Prompts ──────────────────────────────────────────────────────────────────

function buildQualityPrompt(evidence: Record<string, unknown>): string {
  return `You are Dike, an AI code quality auditor.

SUBMITTED EVIDENCE (GitHub activity, commits, files):
${JSON.stringify(evidence, null, 2)}

Evaluate the CODE QUALITY of this submission across these dimensions:
1. Code Structure & Organization (0-20)
2. Readability & Naming (0-20)
3. Best Practices & Patterns (0-20)
4. Security & Error Handling (0-20)
5. Testing & Documentation (0-20)

Respond in JSON:
{
  "overallScore": <number 0-100>,
  "dimensions": {
    "structure": { "score": <0-20>, "notes": "<assessment>" },
    "readability": { "score": <0-20>, "notes": "<assessment>" },
    "bestPractices": { "score": <0-20>, "notes": "<assessment>" },
    "security": { "score": <0-20>, "notes": "<assessment>" },
    "testing": { "score": <0-20>, "notes": "<assessment>" }
  },
  "summary": "<1-2 sentence assessment>",
  "recommendations": ["<improvement 1>", "<improvement 2>"]
}`;
}

// ── Core Logic ───────────────────────────────────────────────────────────────

export async function evaluateQuality(
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
        { role: 'system', content: 'You are an expert code reviewer. Respond only in valid JSON.' },
        { role: 'user', content: buildQualityPrompt(evidence) },
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
      summary: result.summary ?? 'Quality assessment completed',
      reasoning: content,
      recommendations: result.recommendations ?? [],
    };
  } catch (err) {
    log.warn('LLM call failed, using heuristic', {
      error: err instanceof Error ? err.message : String(err),
    });
    return qualityHeuristic(evidence);
  }
}

function qualityHeuristic(evidence: Record<string, unknown>) {
  const commits = (evidence as any).commits ?? [];
  const files = (evidence as any).filesChanged ?? [];

  // Heuristic: reasonable commit messages + file diversity = higher quality
  const msgQuality = commits.filter((c: any) =>
    c.message && c.message.length > 10 && /^(feat|fix|refactor|test|docs|chore)/.test(c.message),
  ).length;

  const score = Math.min(40 + msgQuality * 5 + files.length * 2, 100);

  return {
    score,
    summary: 'Heuristic quality evaluation (LLM unavailable)',
    reasoning: `${commits.length} commits, ${msgQuality} with conventional messages, ${files.length} files`,
    recommendations: ['Enable Groq API key for comprehensive AI code review'],
  };
}

// ── Run Agent ────────────────────────────────────────────────────────────────

export async function runDike(taskId: string): Promise<void> {
  log.info('Dike activated', { taskId });

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      submissions: { orderBy: { submittedAt: 'desc' }, take: 1 },
      agentReports: { where: { agentName: 'ARGUS' }, take: 1 },
    },
  });

  if (!task) return;

  const evidence = (task.submissions[0]?.evidence ?? task.agentReports[0]?.details ?? {}) as Record<string, unknown>;
  const { score, summary, reasoning, recommendations } = await evaluateQuality(evidence);

  await prisma.agentReport.create({
    data: {
      taskId,
      agentName: 'DIKE',
      score,
      confidence: config.groq.apiKey ? 0.8 : 0.45,
      severity: score < 30 ? 'HIGH' : score < 60 ? 'MEDIUM' : 'INFO',
      summary,
      reasoning,
      details: { quality_analysis: true } as any,
      recommendations,
    },
  });

  log.info('Dike report filed', { taskId, score });
}
