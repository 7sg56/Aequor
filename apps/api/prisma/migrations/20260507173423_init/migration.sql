-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'ASSIGNED', 'SUBMITTED', 'REVIEWING', 'APPROVED', 'REVISION_REQUESTED', 'DISPUTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Decision" AS ENUM ('AUTO_RELEASE', 'MANUAL_REVIEW', 'HOLD', 'DISPUTED');

-- CreateEnum
CREATE TYPE "AgentName" AS ENUM ('ARGUS', 'THEMIS', 'DIKE', 'CHRONOS', 'KRATOS', 'NEMESIS', 'PLUTUS');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'STREAMING', 'COMPLETED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'REVIEWING', 'RESOLVED_FOR_CLIENT', 'RESOLVED_FOR_WORKER', 'ESCALATED');

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "repoUrl" TEXT,
    "branch" TEXT NOT NULL DEFAULT 'main',
    "specs" JSONB NOT NULL,
    "escrowAmount" DOUBLE PRECISION NOT NULL,
    "escrowTx" TEXT,
    "clientWallet" TEXT NOT NULL,
    "workerWallet" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "score" DOUBLE PRECISION,
    "decision" "Decision",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "repoUrl" TEXT NOT NULL,
    "branch" TEXT NOT NULL DEFAULT 'main',
    "commitHash" TEXT,
    "prUrl" TEXT,
    "notes" TEXT,
    "evidence" JSONB,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentReport" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "agentName" "AgentName" NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "severity" "Severity" NOT NULL DEFAULT 'INFO',
    "summary" TEXT NOT NULL,
    "reasoning" TEXT,
    "details" JSONB,
    "recommendations" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "fromWallet" TEXT NOT NULL,
    "toWallet" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "txSignature" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "streamRate" DOUBLE PRECISION,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "raisedBy" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence" JSONB,
    "resolution" TEXT,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletReputation" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "totalTasks" INTEGER NOT NULL DEFAULT 0,
    "completedTasks" INTEGER NOT NULL DEFAULT 0,
    "disputeCount" INTEGER NOT NULL DEFAULT 0,
    "avgScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "onChainReputation" DOUBLE PRECISION,
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActive" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletReputation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Task_clientWallet_idx" ON "Task"("clientWallet");

-- CreateIndex
CREATE INDEX "Task_workerWallet_idx" ON "Task"("workerWallet");

-- CreateIndex
CREATE INDEX "Task_status_idx" ON "Task"("status");

-- CreateIndex
CREATE INDEX "Submission_taskId_idx" ON "Submission"("taskId");

-- CreateIndex
CREATE INDEX "AgentReport_taskId_idx" ON "AgentReport"("taskId");

-- CreateIndex
CREATE INDEX "AgentReport_agentName_idx" ON "AgentReport"("agentName");

-- CreateIndex
CREATE INDEX "Payment_taskId_idx" ON "Payment"("taskId");

-- CreateIndex
CREATE INDEX "Payment_fromWallet_idx" ON "Payment"("fromWallet");

-- CreateIndex
CREATE INDEX "Payment_toWallet_idx" ON "Payment"("toWallet");

-- CreateIndex
CREATE INDEX "Dispute_taskId_idx" ON "Dispute"("taskId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_actor_idx" ON "AuditLog"("actor");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WalletReputation_address_key" ON "WalletReputation"("address");

-- CreateIndex
CREATE INDEX "WalletReputation_address_idx" ON "WalletReputation"("address");

-- CreateIndex
CREATE INDEX "WalletReputation_score_idx" ON "WalletReputation"("score");

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentReport" ADD CONSTRAINT "AgentReport_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
