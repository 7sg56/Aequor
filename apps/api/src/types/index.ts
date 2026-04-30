/**
 * Core type definitions for Aequor — a Solana-based payment streaming platform
 * with multi-agent fraud detection and compliance monitoring.
 */

// ── Payment & Transaction Types ──────────────────────────────────────────────

export interface StreamPayment {
  id: string;
  sender: string;          // Solana public key
  recipient: string;       // Solana public key
  amount: number;          // lamports
  tokenMint?: string;      // SPL token mint address
  ratePerSecond: number;
  startTime: number;       // unix timestamp
  endTime?: number;
  status: PaymentStatus;
  escrowAddress: string;
  txSignature: string;
  metadata?: PaymentMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export type PaymentStatus =
  | 'pending'
  | 'active'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'disputed'
  | 'flagged';

export interface PaymentMetadata {
  memo?: string;
  category?: PaymentCategory;
  tags?: string[];
  invoiceRef?: string;
}

export type PaymentCategory =
  | 'salary'
  | 'subscription'
  | 'service'
  | 'grant'
  | 'bounty'
  | 'other';

// ── Escrow Types ─────────────────────────────────────────────────────────────

export interface EscrowAccount {
  id: string;
  address: string;
  paymentId: string;
  balance: number;
  lockedUntil?: number;
  releaseConditions: ReleaseCondition[];
  status: 'locked' | 'partial_release' | 'released' | 'disputed';
}

export interface ReleaseCondition {
  type: 'time' | 'milestone' | 'approval' | 'oracle';
  value: string;
  met: boolean;
  metAt?: Date;
}

// ── Agent Types ──────────────────────────────────────────────────────────────

export type AgentName =
  | 'argus'     // surveillance & pattern detection
  | 'themis'    // compliance & regulation
  | 'dike'      // justice & dispute resolution
  | 'chronos'   // time-based analysis & scheduling
  | 'kratos'    // authority & access control
  | 'nemesis'   // fraud retaliation & blacklisting
  | 'plutus';   // financial analysis & treasury

export interface AgentReport {
  agentName: AgentName;
  timestamp: Date;
  paymentId?: string;
  walletAddress?: string;
  severity: SeverityLevel;
  category: string;
  summary: string;
  details: Record<string, unknown>;
  recommendations: string[];
  confidence: number;       // 0-1 float
}

export type SeverityLevel = 'info' | 'low' | 'medium' | 'high' | 'critical';

export interface AgentConfig {
  name: AgentName;
  enabled: boolean;
  interval: number;         // polling interval in ms
  thresholds: Record<string, number>;
  webhookUrl?: string;
}

// ── Risk & Audit Types ───────────────────────────────────────────────────────

export interface RiskScore {
  walletAddress: string;
  overall: number;          // 0-100
  breakdown: {
    velocityRisk: number;
    volumeRisk: number;
    patternRisk: number;
    networkRisk: number;
    reputationRisk: number;
  };
  factors: RiskFactor[];
  lastUpdated: Date;
}

export interface RiskFactor {
  name: string;
  weight: number;
  score: number;
  description: string;
}

export interface AuditEntry {
  id: string;
  timestamp: Date;
  action: AuditAction;
  actor: string;            // wallet or system agent
  target: string;           // payment id, wallet, etc.
  details: Record<string, unknown>;
  agentReports?: AgentReport[];
  ipAddress?: string;
}

export type AuditAction =
  | 'payment_created'
  | 'payment_approved'
  | 'payment_flagged'
  | 'payment_cancelled'
  | 'escrow_locked'
  | 'escrow_released'
  | 'dispute_opened'
  | 'dispute_resolved'
  | 'risk_score_updated'
  | 'wallet_blacklisted'
  | 'wallet_whitelisted'
  | 'config_changed';

// ── Reputation Types ─────────────────────────────────────────────────────────

export interface WalletReputation {
  address: string;
  score: number;            // 0-100
  totalTransactions: number;
  successfulPayments: number;
  disputeCount: number;
  flagCount: number;
  firstSeen: Date;
  lastActive: Date;
  badges: ReputationBadge[];
}

export type ReputationBadge =
  | 'verified'
  | 'trusted_sender'
  | 'trusted_receiver'
  | 'high_volume'
  | 'early_adopter'
  | 'dispute_free';

// ── Queue & Event Types ──────────────────────────────────────────────────────

export interface QueueJob<T = unknown> {
  id: string;
  type: JobType;
  payload: T;
  priority: number;
  attempts: number;
  maxAttempts: number;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'dead';
  createdAt: Date;
  processedAt?: Date;
  error?: string;
}

export type JobType =
  | 'process_payment'
  | 'analyze_risk'
  | 'run_agent'
  | 'sync_blockchain'
  | 'send_notification'
  | 'generate_report';

export interface SystemEvent {
  id: string;
  type: string;
  source: AgentName | 'system' | 'user';
  data: Record<string, unknown>;
  timestamp: Date;
}

// ── API Response Types ───────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    timestamp: number;
  };
}

// ── Dashboard / Analytics Types ──────────────────────────────────────────────

export interface DashboardStats {
  totalVolume: number;
  activeStreams: number;
  completedPayments: number;
  disputeRate: number;
  avgRiskScore: number;
  agentAlerts: number;
  escrowBalance: number;
  topWallets: Array<{
    address: string;
    volume: number;
    reputation: number;
  }>;
}

export interface TimeSeriesPoint {
  timestamp: number;
  value: number;
  label?: string;
}
