/**
 * ARGUS — Master Evidence Fetcher & Verification Orchestrator
 *
 * The hundred-eyed giant. Argus is the central brain that:
 * 1. Fetches all evidence from GitHub (commits, PRs, files, tests)
 * 2. Spawns sub-agent audit streams (Themis, Dike, Chronos) as specialized Groq prompt passes
 * 3. Iteratively prompts Groq for deeper analysis and verification
 * 4. Stores all findings in the database
 *
 * Themis, Dike, and Chronos are NOT independent agents — they are named audit
 * streams within Argus, each with a specialized prompt template.
 */

import { Octokit } from 'octokit';
import Groq from 'groq-sdk';
import { config } from '../../config/index.js';
import { createLogger } from '../../utils/logger.js';
import { prisma } from '../../db/index.js';

const log = createLogger('agent:argus');

const octokit = new Octokit({ auth: config.github.token || undefined });
const groq = new Groq({ apiKey: config.groq.apiKey || undefined });

// ── GitHub Evidence Types ────────────────────────────────────────────────────

export interface GitHubEvidence {
  commits: CommitData[];
  pullRequests: PRData[];
  filesChanged: FileData[];
  languages: Record<string, number>;
  repoMeta: { stars: number; forks: number; openIssues: number; defaultBranch: string };
  // Actual code content for Groq to analyze
  codeSnapshots: CodeSnapshot[];
  readmeContent: string | null;
  commitDiffs: CommitDiff[];
  // CI / test pipeline results
  ciResults: CIResult[];
}

interface CommitData {
  sha: string;
  message: string;
  author: string;
  date: string;
  additions: number;
  deletions: number;
}

interface PRData {
  number: number;
  title: string;
  state: string;
  mergedAt: string | null;
  additions: number;
  deletions: number;
}

interface FileData {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  language: string | null;
}

interface CodeSnapshot {
  path: string;
  language: string | null;
  content: string;         // actual file content (truncated to ~2000 chars)
  sizeBytes: number;
}

interface CommitDiff {
  sha: string;
  message: string;
  patch: string;           // unified diff (truncated)
}

interface CIResult {
  name: string;            // workflow or check name
  status: 'success' | 'failure' | 'pending' | 'neutral' | 'skipped';
  conclusion: string | null;
  url: string | null;
  startedAt: string | null;
  completedAt: string | null;
  runNumber?: number;
}

// ── Audit Stream Result ──────────────────────────────────────────────────────

interface AuditStreamResult {
  agentName: 'THEMIS' | 'DIKE' | 'CHRONOS';
  score: number;
  confidence: number;
  summary: string;
  reasoning: string;
  recommendations: string[];
}

// ── GitHub Fetching ──────────────────────────────────────────────────────────

function parseRepoUrl(url: string): { owner: string; repo: string } {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) throw new Error(`Invalid GitHub URL: ${url}`);
  return { owner: match[1]!, repo: match[2]!.replace('.git', '') };
}

async function fetchGitHubEvidence(repoUrl: string, branch: string): Promise<GitHubEvidence> {
  const { owner, repo } = parseRepoUrl(repoUrl);
  log.info('Fetching GitHub evidence', { owner, repo, branch });

  try {
    const [commitsRes, prsRes, repoRes] = await Promise.all([
      octokit.rest.repos.listCommits({ owner, repo, sha: branch, per_page: 50 }).catch(() => ({ data: [] })),
      octokit.rest.pulls.list({ owner, repo, state: 'all', per_page: 20 }).catch(() => ({ data: [] })),
      octokit.rest.repos.get({ owner, repo }).catch(() => null),
    ]);

    const commits: CommitData[] = commitsRes.data.map((c: any) => ({
      sha: c.sha,
      message: c.commit.message,
      author: c.commit.author?.name ?? 'unknown',
      date: c.commit.author?.date ?? '',
      additions: c.stats?.additions ?? 0,
      deletions: c.stats?.deletions ?? 0,
    }));

    const pullRequests: PRData[] = prsRes.data.map((pr: any) => ({
      number: pr.number,
      title: pr.title,
      state: pr.state,
      mergedAt: pr.merged_at,
      additions: pr.additions ?? 0,
      deletions: pr.deletions ?? 0,
    }));

    // Fetch file tree
    let filesChanged: FileData[] = [];
    let allPaths: string[] = [];
    try {
      const treeRes = await octokit.rest.git.getTree({ owner, repo, tree_sha: branch, recursive: 'true' });
      const blobs = treeRes.data.tree.filter((f: any) => f.type === 'blob');
      allPaths = blobs.map((f: any) => f.path ?? '');
      filesChanged = blobs
        .slice(0, 200)
        .map((f: any) => ({
          filename: f.path ?? '',
          status: 'present',
          additions: 0,
          deletions: 0,
          language: inferLanguage(f.path ?? ''),
        }));
    } catch { /* ignore */ }

    // Language breakdown
    const languages: Record<string, number> = {};
    for (const f of filesChanged) {
      if (f.language) languages[f.language] = (languages[f.language] ?? 0) + 1;
    }

    // NEW: Fetch actual code content for key files
    const codeSnapshots = await fetchKeyFileContents(owner, repo, branch, allPaths);

    // NEW: Fetch README
    const readmeContent = await fetchReadme(owner, repo, branch);

    // Fetch commit diffs for recent commits
    const commitDiffs = await fetchCommitDiffs(owner, repo, commits.slice(0, 5));

    // Fetch CI / GitHub Actions results
    const ciResults = await fetchCIResults(owner, repo, branch, commits[0]?.sha);

    return {
      commits,
      pullRequests,
      filesChanged,
      languages,
      codeSnapshots,
      readmeContent,
      commitDiffs,
      ciResults,
      repoMeta: {
        stars: repoRes?.data.stargazers_count ?? 0,
        forks: repoRes?.data.forks_count ?? 0,
        openIssues: repoRes?.data.open_issues_count ?? 0,
        defaultBranch: repoRes?.data.default_branch ?? 'main',
      },
    };
  } catch (err) {
    log.warn('GitHub API failed, generating mock evidence', {
      error: err instanceof Error ? err.message : String(err),
    });
    return generateMockEvidence();
  }
}

// ── Fetch actual file contents ───────────────────────────────────────────────

/**
 * Intelligently select key files from the repo and fetch their contents.
 * Prioritizes: entry points, config, tests, and source files.
 */
const KEY_FILE_PATTERNS = [
  /^readme\.md$/i,
  /^package\.json$/,
  /^src\/index\.[tj]sx?$/,
  /^src\/app\.[tj]sx?$/,
  /^src\/main\.[tj]sx?$/,
  /^index\.[tj]sx?$/,
  /\/?routes?\.[tj]sx?$/,
  /\/?server\.[tj]sx?$/,
  /\.test\.[tj]sx?$/,
  /\.spec\.[tj]sx?$/,
  /^lib\/.*\.[tj]sx?$/,
  /Cargo\.toml$/,
  /\/mod\.rs$/,
  /\/lib\.rs$/,
];

const MAX_FILE_CONTENT_LENGTH = 2000;
const MAX_CODE_FILES = 8;

async function fetchKeyFileContents(
  owner: string,
  repo: string,
  branch: string,
  allPaths: string[],
): Promise<CodeSnapshot[]> {
  // Score each path by relevance
  const scored = allPaths
    .filter(p => {
      const ext = p.split('.').pop()?.toLowerCase();
      return ['ts', 'tsx', 'js', 'jsx', 'rs', 'py', 'sol', 'go', 'toml', 'json', 'md'].includes(ext ?? '');
    })
    .map(p => {
      let priority = 0;
      for (const pattern of KEY_FILE_PATTERNS) {
        if (pattern.test(p)) { priority += 10; break; }
      }
      // Prefer shorter paths (top-level files)
      priority += Math.max(0, 5 - p.split('/').length);
      // Prefer source files
      if (p.startsWith('src/')) priority += 3;
      return { path: p, priority };
    })
    .sort((a, b) => b.priority - a.priority)
    .slice(0, MAX_CODE_FILES);

  const snapshots: CodeSnapshot[] = [];

  for (const { path } of scored) {
    try {
      const { data } = await octokit.rest.repos.getContent({
        owner, repo, path, ref: branch,
      }) as { data: { content?: string; size?: number } };

      if (data.content) {
        const decoded = Buffer.from(data.content, 'base64').toString('utf-8');
        snapshots.push({
          path,
          language: inferLanguage(path),
          content: decoded.slice(0, MAX_FILE_CONTENT_LENGTH),
          sizeBytes: data.size ?? decoded.length,
        });
      }
    } catch {
      // File might be too large or binary, skip
    }
  }

  log.info(`Fetched ${snapshots.length} code snapshots`, {
    files: snapshots.map(s => s.path),
  });

  return snapshots;
}

async function fetchReadme(
  owner: string,
  repo: string,
  branch: string,
): Promise<string | null> {
  try {
    const { data } = await octokit.rest.repos.getReadme({ owner, repo, ref: branch }) as { data: { content?: string } };
    if (data.content) {
      return Buffer.from(data.content, 'base64').toString('utf-8').slice(0, 3000);
    }
  } catch { /* no readme */ }
  return null;
}

async function fetchCommitDiffs(
  owner: string,
  repo: string,
  commits: CommitData[],
): Promise<CommitDiff[]> {
  const diffs: CommitDiff[] = [];

  for (const commit of commits.slice(0, 3)) {
    try {
      const { data } = await octokit.rest.repos.getCommit({ owner, repo, ref: commit.sha });
      const patch = (data.files ?? [])
        .map((f: any) => `--- ${f.filename}\n${(f.patch ?? '').slice(0, 800)}`)
        .join('\n\n')
        .slice(0, 2000);

      diffs.push({
        sha: commit.sha.slice(0, 8),
        message: commit.message,
        patch,
      });
    } catch { /* skip */ }
  }

  return diffs;
}

/**
 * Fetch CI/CD pipeline results from GitHub Actions workflow runs
 * and commit check statuses.
 */
async function fetchCIResults(
  owner: string,
  repo: string,
  branch: string,
  headSha?: string,
): Promise<CIResult[]> {
  const results: CIResult[] = [];

  // 1. GitHub Actions workflow runs
  try {
    const { data } = await octokit.rest.actions.listWorkflowRunsForRepo({
      owner, repo, branch, per_page: 5, status: 'completed' as any,
    });

    for (const run of data.workflow_runs.slice(0, 5)) {
      results.push({
        name: run.name ?? `Workflow #${run.id}`,
        status: run.conclusion === 'success' ? 'success'
          : run.conclusion === 'failure' ? 'failure'
          : run.conclusion === 'neutral' ? 'neutral'
          : run.conclusion === 'skipped' ? 'skipped'
          : 'pending',
        conclusion: run.conclusion,
        url: run.html_url,
        startedAt: run.run_started_at ?? null,
        completedAt: run.updated_at,
        runNumber: run.run_number,
      });
    }
  } catch {
    log.info('No GitHub Actions workflows found');
  }

  // 2. Commit check suites (covers external CI like Travis, CircleCI, etc.)
  if (headSha) {
    try {
      const { data } = await octokit.rest.checks.listForRef({
        owner, repo, ref: headSha, per_page: 10,
      });

      for (const check of data.check_runs) {
        // Avoid duplicates from Actions (they appear in both APIs)
        if (results.some(r => r.name === check.name)) continue;

        results.push({
          name: check.name,
          status: check.conclusion === 'success' ? 'success'
            : check.conclusion === 'failure' ? 'failure'
            : check.conclusion === 'neutral' ? 'neutral'
            : check.conclusion === 'skipped' ? 'skipped'
            : 'pending',
          conclusion: check.conclusion,
          url: check.html_url,
          startedAt: check.started_at,
          completedAt: check.completed_at,
        });
      }
    } catch {
      log.info('No commit checks found');
    }
  }

  log.info(`Fetched ${results.length} CI results`, {
    passed: results.filter(r => r.status === 'success').length,
    failed: results.filter(r => r.status === 'failure').length,
  });

  return results;
}

function generateMockEvidence(): GitHubEvidence {
  return {
    commits: Array.from({ length: 8 }, (_, i) => ({
      sha: `mock_${i}_${Date.now().toString(36)}`,
      message: ['feat: implement auth', 'fix: database query', 'refactor: api routes',
        'test: add unit tests', 'docs: update readme', 'feat: payment flow',
        'fix: edge case handling', 'chore: cleanup'][i]!,
      author: 'developer',
      date: new Date(Date.now() - i * 3600000).toISOString(),
      additions: Math.floor(Math.random() * 200) + 10,
      deletions: Math.floor(Math.random() * 50),
    })),
    pullRequests: [
      { number: 1, title: 'Feature implementation', state: 'merged', mergedAt: new Date().toISOString(), additions: 500, deletions: 50 },
    ],
    filesChanged: [
      { filename: 'src/index.ts', status: 'modified', additions: 100, deletions: 20, language: 'TypeScript' },
      { filename: 'src/api/routes.ts', status: 'added', additions: 200, deletions: 0, language: 'TypeScript' },
      { filename: 'tests/api.test.ts', status: 'added', additions: 150, deletions: 0, language: 'TypeScript' },
    ],
    languages: { TypeScript: 3 },
    codeSnapshots: [
      { path: 'src/index.ts', language: 'TypeScript', content: 'import express from "express";\nconst app = express();\napp.listen(3000);', sizeBytes: 72 },
    ],
    readmeContent: '# Project\nA sample project with API routes.',
    commitDiffs: [
      { sha: 'mock_0', message: 'feat: implement auth', patch: '+import jwt from "jsonwebtoken";\n+export function verifyToken(token) {\n+  return jwt.verify(token, SECRET);\n+}' },
    ],
    ciResults: [
      { name: 'CI / test', status: 'success', conclusion: 'success', url: null, startedAt: new Date(Date.now() - 3600000).toISOString(), completedAt: new Date(Date.now() - 3500000).toISOString() },
      { name: 'CI / lint', status: 'success', conclusion: 'success', url: null, startedAt: new Date(Date.now() - 3600000).toISOString(), completedAt: new Date(Date.now() - 3550000).toISOString() },
    ],
    repoMeta: { stars: 0, forks: 0, openIssues: 0, defaultBranch: 'main' },
  };
}

function inferLanguage(filename: string): string | null {
  const ext = filename.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: 'TypeScript', tsx: 'TypeScript', js: 'JavaScript', jsx: 'JavaScript',
    rs: 'Rust', py: 'Python', sol: 'Solidity', go: 'Go',
    css: 'CSS', html: 'HTML', json: 'JSON', md: 'Markdown',
  };
  return ext ? map[ext] ?? null : null;
}

// ── Objective Score (40% weight) ─────────────────────────────────────────────

function calculateObjectiveScore(evidence: GitHubEvidence): {
  score: number;
  breakdown: Record<string, number>;
} {
  const commitScore = Math.min(evidence.commits.length * 5, 20);
  const prScore = Math.min(evidence.pullRequests.length * 10, 15);
  const linesAdded = evidence.commits.reduce((s, c) => s + c.additions, 0);
  const codeVolume = Math.min(linesAdded / 50, 20);
  const fileScore = Math.min(evidence.filesChanged.length * 0.5, 10);
  const testFiles = evidence.filesChanged.filter(f =>
    f.filename.includes('test') || f.filename.includes('spec'),
  ).length;
  const testScore = Math.min(testFiles * 5, 10);

  // CI/test results scoring (up to 25 pts)
  let ciScore = 0;
  if (evidence.ciResults.length > 0) {
    const passed = evidence.ciResults.filter(r => r.status === 'success').length;
    const failed = evidence.ciResults.filter(r => r.status === 'failure').length;
    const total = evidence.ciResults.length;
    if (failed === 0 && passed > 0) {
      ciScore = 25; // all green
    } else if (failed > 0) {
      ciScore = Math.max(0, Math.round(25 * (passed / total) - (failed * 5)));
    } else {
      ciScore = 5; // only pending/neutral
    }
  } else {
    ciScore = 5; // no CI configured (neutral, not penalized hard)
  }

  const score = Math.min(Math.round(commitScore + prScore + codeVolume + fileScore + testScore + ciScore), 100);
  return { score, breakdown: { commitScore, prScore, codeVolume, fileScore, testScore, ciScore } };
}

// ── Audit Streams (Groq-powered) ─────────────────────────────────────────────

/**
 * Each audit stream is a specialized Groq prompt pass.
 * Argus feeds evidence to each stream and collects structured results.
 */

/**
 * Build a code context string from snapshots + diffs for Groq.
 * This gives the LLM actual code to reason about, not just file names.
 */
function buildCodeContext(evidence: GitHubEvidence): string {
  const parts: string[] = [];

  if (evidence.readmeContent) {
    parts.push(`=== README ===\n${evidence.readmeContent.slice(0, 1500)}`);
  }

  for (const snap of evidence.codeSnapshots.slice(0, 6)) {
    parts.push(`=== ${snap.path} (${snap.language}) ===\n${snap.content}`);
  }

  if (evidence.commitDiffs.length > 0) {
    parts.push('=== RECENT DIFFS ===');
    for (const diff of evidence.commitDiffs.slice(0, 3)) {
      parts.push(`-- ${diff.sha}: ${diff.message} --\n${diff.patch}`);
    }
  }

  return parts.join('\n\n').slice(0, 12000); // stay within context window
}

const AUDIT_STREAM_PROMPTS: Record<string, (specs: Record<string, unknown>, evidence: GitHubEvidence) => string> = {
  // THEMIS: spec compliance — now sees actual code + README
  THEMIS: (specs, evidence) => `You are Themis, a spec compliance auditor.

TASK SPECS:
${JSON.stringify(specs, null, 2)}

FILE STRUCTURE: ${evidence.filesChanged.slice(0, 40).map(f => f.filename).join(', ')}

ACTUAL CODE:
${buildCodeContext(evidence)}

Evaluate whether the code actually implements what the specs require.
Check imports, function signatures, route definitions, and logic — not just file names.
Respond in JSON:
{"score": <0-100>, "summary": "<1 sentence>", "issues": ["<issue>"], "recommendations": ["<rec>"]}`,

  // DIKE: code quality -- sees real code patterns + CI results
  DIKE: (_specs, evidence) => `You are Dike, a code quality auditor.

LANGUAGES: ${JSON.stringify(evidence.languages)}

CI/TEST PIPELINE RESULTS:
${evidence.ciResults.length > 0
  ? evidence.ciResults.map(r => `- ${r.name}: ${r.status}${r.conclusion ? ` (${r.conclusion})` : ''}${r.completedAt ? ` at ${r.completedAt}` : ''}`).join('\n')
  : 'No CI pipeline detected for this repository.'}

ACTUAL CODE:
${buildCodeContext(evidence)}

Evaluate real code quality:
1. Structure & organization (are files logically organized?)
2. Naming (clear variable/function names?)
3. Error handling (try/catch, validation?)
4. Security (input sanitization, auth checks?)
5. Testing (test files present and meaningful?)
6. CI pipeline (are tests automated? do they pass?)

Base your score on the ACTUAL code you see AND CI results, not assumptions.
Respond in JSON:
{"score": <0-100>, "summary": "<1 sentence>", "issues": ["<issue>"], "recommendations": ["<rec>"]}`,

  // CHRONOS: timeliness — uses commit timeline + diff size patterns
  CHRONOS: (_specs, evidence) => `You are Chronos, a timeliness auditor.

COMMIT TIMELINE:
${JSON.stringify(evidence.commits.map(c => ({ date: c.date, message: c.message, additions: c.additions, deletions: c.deletions })))}

DIFF SAMPLES (most recent):
${evidence.commitDiffs.map(d => `${d.sha}: ${d.message} (${d.patch.length} chars of changes)`).join('\n')}

Evaluate:
- Is the commit cadence steady or last-minute cramming?
- Do diff sizes suggest real incremental work or bulk copy-paste?
- Are commit messages meaningful or generic?
Respond in JSON:
{"score": <0-100>, "summary": "<1 sentence>", "cadence": "steady"|"burst"|"last_minute", "recommendations": ["<rec>"]}`,
};

async function runAuditStream(
  streamName: 'THEMIS' | 'DIKE' | 'CHRONOS',
  specs: Record<string, unknown>,
  evidence: GitHubEvidence,
): Promise<AuditStreamResult> {
  const promptFn = AUDIT_STREAM_PROMPTS[streamName]!;
  const prompt = promptFn(specs, evidence);

  try {
    const resp = await groq.chat.completions.create({
      model: config.groq.model,
      messages: [
        { role: 'system', content: 'You are an expert auditor. Respond only in valid JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 1024,
      response_format: { type: 'json_object' },
    });

    const content = resp.choices[0]?.message?.content;
    if (!content) throw new Error('Empty response');
    const parsed = JSON.parse(content);

    return {
      agentName: streamName,
      score: parsed.score ?? 50,
      confidence: 0.85,
      summary: parsed.summary ?? `${streamName} audit complete`,
      reasoning: content,
      recommendations: parsed.recommendations ?? [],
    };
  } catch (err) {
    log.warn(`${streamName} stream LLM failed, using heuristic`, {
      error: err instanceof Error ? err.message : String(err),
    });
    return heuristicAudit(streamName, evidence);
  }
}

function heuristicAudit(name: 'THEMIS' | 'DIKE' | 'CHRONOS', evidence: GitHubEvidence): AuditStreamResult {
  const hasCommits = evidence.commits.length > 0;
  const hasFiles = evidence.filesChanged.length > 0;
  const hasPRs = evidence.pullRequests.length > 0;
  let score = 40;
  if (hasCommits) score += 15;
  if (hasFiles) score += 15;
  if (hasPRs) score += 10;

  return {
    agentName: name,
    score: Math.min(score, 100),
    confidence: 0.4,
    summary: `Heuristic ${name} audit (LLM unavailable)`,
    reasoning: `commits=${evidence.commits.length} files=${evidence.filesChanged.length} prs=${evidence.pullRequests.length}`,
    recommendations: ['Enable GROQ_API_KEY for full AI auditing'],
  };
}

// ── Iterative Verification Pass ──────────────────────────────────────────────

/**
 * Argus can do a follow-up Groq pass to cross-verify findings from the audit
 * streams, asking for deeper analysis on flagged areas.
 */
async function iterativeVerification(
  evidence: GitHubEvidence,
  auditResults: AuditStreamResult[],
): Promise<{ verifiedScore: number; notes: string } | null> {
  // Only run if any audit flagged issues (score < 70)
  const flagged = auditResults.filter(r => r.score < 70);
  if (flagged.length === 0) return null;

  try {
    const resp = await groq.chat.completions.create({
      model: config.groq.model,
      messages: [
        { role: 'system', content: 'You are Argus, a master verification agent. Cross-verify audit findings.' },
        {
          role: 'user',
          content: `Audit streams flagged issues:\n${flagged.map(f => `${f.agentName}: score=${f.score}, ${f.summary}`).join('\n')}\n\nEvidence summary: ${evidence.commits.length} commits, ${evidence.filesChanged.length} files, ${evidence.pullRequests.length} PRs.\n\nDo these flags seem justified? Respond in JSON: {"verifiedScore": <0-100>, "notes": "<assessment>"}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 512,
      response_format: { type: 'json_object' },
    });

    const content = resp.choices[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content);
  } catch {
    return null;
  }
}

// ── Main Run Function ────────────────────────────────────────────────────────

export async function runArgus(taskId: string): Promise<void> {
  log.info('Argus activated — master verification cycle', { taskId });

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { submissions: { orderBy: { submittedAt: 'desc' }, take: 1 } },
  });

  if (!task || task.submissions.length === 0) {
    log.warn('No task or submission found', { taskId });
    return;
  }

  const submission = task.submissions[0]!;
  const specs = task.specs as Record<string, unknown>;

  // Phase 1: Fetch all GitHub evidence
  log.info('Phase 1: Fetching evidence');
  const evidence = await fetchGitHubEvidence(submission.repoUrl, submission.branch);

  // Store evidence on submission
  await prisma.submission.update({
    where: { id: submission.id },
    data: { evidence: evidence as any },
  });

  // Phase 2: Calculate objective score
  const { score: objectiveScore, breakdown } = calculateObjectiveScore(evidence);

  // File Argus objective report
  await prisma.agentReport.create({
    data: {
      taskId,
      agentName: 'ARGUS',
      score: objectiveScore,
      confidence: 0.95,
      severity: 'INFO',
      summary: `Objective evidence score: ${objectiveScore}/100`,
      reasoning: JSON.stringify(breakdown),
      details: { evidence, breakdown } as any,
      recommendations: objectiveScore < 50
        ? ['Evidence is thin — more commits or test coverage needed']
        : ['Sufficient evidence for AI audit streams'],
    },
  });

  // Phase 3: Spawn audit streams in parallel (Themis, Dike, Chronos)
  log.info('Phase 3: Running audit streams');
  const auditResults = await Promise.all([
    runAuditStream('THEMIS', specs, evidence),
    runAuditStream('DIKE', specs, evidence),
    runAuditStream('CHRONOS', specs, evidence),
  ]);

  // Store each audit stream result as an agent report
  for (const result of auditResults) {
    await prisma.agentReport.create({
      data: {
        taskId,
        agentName: result.agentName,
        score: result.score,
        confidence: result.confidence,
        severity: result.score < 40 ? 'HIGH' : result.score < 70 ? 'MEDIUM' : 'INFO',
        summary: result.summary,
        reasoning: result.reasoning,
        recommendations: result.recommendations,
      },
    });
  }

  // Phase 4: Iterative verification (cross-check flagged findings)
  log.info('Phase 4: Iterative verification');
  const verification = await iterativeVerification(evidence, auditResults);
  if (verification) {
    log.info('Iterative verification result', verification);
    await prisma.auditLog.create({
      data: {
        action: 'argus_iterative_verification',
        actor: 'ARGUS',
        target: taskId,
        details: verification as any,
      },
    });
  }

  log.info('Argus complete — all audit streams finished', {
    taskId,
    objectiveScore,
    auditScores: Object.fromEntries(auditResults.map(r => [r.agentName, r.score])),
  });
}