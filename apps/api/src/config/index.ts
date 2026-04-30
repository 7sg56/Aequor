import dotenv from 'dotenv';

dotenv.config();

function env(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function envInt(key: string, fallback: number): number {
  const raw = process.env[key];
  return raw ? parseInt(raw, 10) : fallback;
}

export const config = {
  // ── Server ─────────────────────────────────────────────────────────────────
  port: envInt('PORT', 4000),
  host: env('HOST', '0.0.0.0'),
  nodeEnv: env('NODE_ENV', 'development'),
  corsOrigin: env('CORS_ORIGIN', 'http://localhost:3000'),

  // ── Solana / Blockchain ────────────────────────────────────────────────────
  solana: {
    rpcUrl: env('SOLANA_RPC_URL', 'https://api.devnet.solana.com'),
    wsUrl: env('SOLANA_WS_URL', 'wss://api.devnet.solana.com'),
    programId: env('AEQUOR_PROGRAM_ID', ''),
    escrowProgramId: env('ESCROW_PROGRAM_ID', ''),
    reputationProgramId: env('REPUTATION_PROGRAM_ID', ''),
    streamProgramId: env('STREAM_PROGRAM_ID', ''),
    swarmProgramId: env('SWARM_PROGRAM_ID', ''),
    commitment: env('SOLANA_COMMITMENT', 'confirmed') as 'confirmed' | 'finalized',
  },

  // ── Database (PostgreSQL + Prisma) ─────────────────────────────────────────
  db: {
    url: env('DATABASE_URL', 'postgresql://aequeor:aequeor@localhost:5432/aequeor'),
  },

  // ── Queue (Redis + BullMQ) ─────────────────────────────────────────────────
  redis: {
    url: env('REDIS_URL', 'redis://localhost:6379'),
    host: env('REDIS_HOST', 'localhost'),
    port: envInt('REDIS_PORT', 6379),
  },

  // ── AI / LLM (Groq) ──────────────────────────────────────────────────────
  groq: {
    apiKey: env('GROQ_API_KEY', ''),
    model: env('GROQ_MODEL', 'llama-3.3-70b-versatile'),
  },

  // ── GitHub (Octokit) ───────────────────────────────────────────────────────
  github: {
    token: env('GITHUB_TOKEN', ''),
  },

  // ── Agent Configuration ────────────────────────────────────────────────────
  agents: {
    pollingInterval: envInt('AGENT_POLLING_INTERVAL', 10_000),
    riskThreshold: envInt('RISK_THRESHOLD', 80),
    maxConcurrent: envInt('AGENT_MAX_CONCURRENT', 5),
  },

  // ── Scoring Weights ────────────────────────────────────────────────────────
  scoring: {
    objectiveWeight: 0.4,
    aiReasoningWeight: 0.6,
    autoReleaseThreshold: 80,
    reviewThreshold: 60,
  },
} as const;

export type Config = typeof config;
