# Aequor — AI-Verified Freelance Payments on Solana

> Multi-agent work verification + conditional payment streaming platform for dev gigs.

## Architecture

```
Client/Worker Submit Work
        |
        v
   [Argus] — Evidence Fetcher (GitHub commits, PRs, tests, files)
        |     Spawns audit streams via Groq:
        v (parallel)
+-------+-------+
[Themis] [Dike] [Chronos]
Spec     Quality  Timeliness
        |
        v
   [Kratos] — Consensus Orchestrator (40% objective + 60% AI)
        |
   +----+----+
   |         |
[Plutus]  [Nemesis]
Payment   Disputes
Streamer  Arbiter
```

## Project Structure

```
driftpay/
  apps/
    web/          — Next.js frontend (dashboard, landing)
    api/          — Fastify backend (agents, routes, Prisma)
      src/
        agents/   — Argus, Themis, Dike, Chronos, Kratos, Nemesis, Plutus
        api/      — Fastify route handlers
        blockchain/ — Solana interaction layer
        config/   — Environment config
        db/       — Prisma client
        queue/    — BullMQ job queues
        types/    — TypeScript type definitions
        utils/    — Logger, crypto helpers
      prisma/     — Schema + migrations
    tests/        — Integration tests
  chain/          — Solana Anchor programs
    programs/
      aequor/           — Core program
      escrow/           — Escrow logic
      reputation/       — On-chain reputation
      stream_payment/   — Streamed payouts
      swarm_bus/        — Inter-agent messaging
```

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js + TypeScript + Tailwind |
| Backend | Fastify + TypeScript |
| Queue | Redis + BullMQ |
| LLM | Groq API (llama-3.3-70b) |
| Database | PostgreSQL + Prisma |
| Blockchain | Solana devnet (Anchor) |

## Getting Started

```bash
# 1. Start infrastructure
docker-compose up -d

# 2. Install deps
yarn install

# 3. Setup API
cd apps/api
cp .env.example .env
npx prisma migrate dev --name init
npx prisma generate

# 4. Run
yarn web   # frontend on :3000
yarn api   # backend on :4000
```

## Scoring Model

| Signal Type | Weight | Examples |
|---|---|---|
| Objective | 40% | commits, tests passed, files changed, deadlines |
| AI Reasoning | 60% | relevance, quality, completeness, maintainability |

**Payout Rules:**
- Score >= 80 -> Auto release payment (Plutus)
- Score 60-79 -> Manual review / revision request
- Score < 60 -> Hold payment

## Agent Roles

| Agent | Role | Implementation |
|---|---|---|
| Argus | Evidence fetch + audit orchestrator | MVP (GitHub + Groq) |
| Themis | Spec compliance audit stream | MVP (Groq prompt) |
| Dike | Code quality audit stream | MVP (Groq prompt) |
| Chronos | Timeliness audit stream | MVP (Groq prompt) |
| Kratos | Consensus orchestrator | MVP |
| Nemesis | Dispute arbiter | Simulated |
| Plutus | Solana payment streamer | MVP (devnet) |

## License

MIT
