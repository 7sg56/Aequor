# TrustStream — AI-Verified Freelance Payments on Solana

> Multi-agent work verification + conditional payment streaming platform for dev gigs.

## Architecture Overview

```
Client/Worker Submit Work
        │
        ▼
   [Argus] — Evidence Fetcher (GitHub commits, PRs, tests, files)
        │
        ▼ (parallel)
┌───────┼───────┐
[Themis] [Dike] [Chronos]
Spec     Quality  Timeliness
        │
        ▼
   [Kratos] — Consensus Orchestrator (score + decision)
        │
   ┌────┴────┐
   │         │
[Plutus]  [Nemesis]
Payment   Disputes
Streamer  Arbiter
```

## Scoring Model

| Signal Type | Weight | Examples |
|---|---|---|
| Objective | 40% | commits, tests passed, files changed, deadlines |
| AI Reasoning | 60% | relevance, quality, completeness, communication |

**Payout Rules:**
- Score ≥ 80 → Auto release payment
- Score 60–79 → Manual review / revision request
- Score < 60 → Hold payment

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React + TypeScript + Vite |
| Backend | Node.js + TypeScript + Fastify |
| Queue | Redis + BullMQ |
| LLM | Groq API (llama-3.3-70b) |
| Database | PostgreSQL + Prisma |
| Blockchain | Solana devnet |

## Quick Start

```bash
# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Setup environment
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Start services (Docker)
docker-compose up -d

# Run backend
cd backend && npm run dev

# Run frontend
cd frontend && npm run dev
```

## Agent Responsibilities

| Agent | Role | Status |
|---|---|---|
| Argus | Fetches GitHub evidence, scores objective signals | MVP |
| Themis | Spec compliance audit | MVP |
| Dike | Code quality audit | MVP |
| Chronos | Timeliness audit | Partial |
| Kratos | Consensus orchestrator | MVP |
| Nemesis | Dispute arbiter | Simulated |
| Plutus | Solana payment streamer | MVP (devnet) |

## Demo Flow

1. Client creates task with SOL escrow amount
2. Worker submits GitHub repo URL + proof
3. Argus fetches all evidence from GitHub API
4. Themis + Dike run in parallel (auditors)
5. Kratos computes consensus score
6. Score ≥ 80 → Plutus releases/streams payment
7. Dispute → Nemesis reviews audit trail