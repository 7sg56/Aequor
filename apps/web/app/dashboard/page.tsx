"use client";

import { useState } from "react";
import Sidebar from "../components/shared/Sidebar";
import StatCard from "../components/dashboard/StatCard";
import AgentStatusPanel from "../components/dashboard/AgentStatusPanel";
import ScoreRing from "../components/shared/ScoreRing";

// ── Mock Data (replace with API calls) ───────────────────────────────────────

const MOCK_AGENTS = [
  { name: "Argus", role: "Evidence Fetcher + Audit Orchestrator", status: "active" as const, lastScore: 82 },
  { name: "Themis", role: "Spec Compliance (Argus stream)", status: "idle" as const, lastScore: 76 },
  { name: "Dike", role: "Code Quality (Argus stream)", status: "idle" as const, lastScore: 88 },
  { name: "Chronos", role: "Timeliness (Argus stream)", status: "idle" as const, lastScore: 91 },
  { name: "Kratos", role: "Consensus Orchestrator", status: "active" as const, lastScore: 84 },
  { name: "Nemesis", role: "Dispute Arbiter", status: "idle" as const },
  { name: "Plutus", role: "Solana Payment Streamer", status: "active" as const, lastScore: 100 },
];

const MOCK_TASKS = [
  {
    id: "tsk_1", title: "Build REST API for user management",
    status: "COMPLETED", score: 87, decision: "AUTO_RELEASE",
    clientWallet: "7xKX...q3Fp", workerWallet: "9mNb...k2Rj",
    escrowAmount: 2.5, createdAt: "2h ago",
  },
  {
    id: "tsk_2", title: "Implement WebSocket notification system",
    status: "REVIEWING", score: null, decision: null,
    clientWallet: "4pLm...x8Wy", workerWallet: "2kFn...j5Ht",
    escrowAmount: 4.0, createdAt: "5h ago",
  },
  {
    id: "tsk_3", title: "Design landing page with animations",
    status: "SUBMITTED", score: null, decision: null,
    clientWallet: "7xKX...q3Fp", workerWallet: "6tRv...m3Dp",
    escrowAmount: 1.8, createdAt: "1d ago",
  },
  {
    id: "tsk_4", title: "Smart contract audit and testing",
    status: "REVISION_REQUESTED", score: 62, decision: "MANUAL_REVIEW",
    clientWallet: "3bGk...n7Qs", workerWallet: "8wYp...f4Lx",
    escrowAmount: 8.0, createdAt: "2d ago",
  },
];

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  OPEN: { label: "Open", class: "badge-info" },
  ASSIGNED: { label: "Assigned", class: "badge-info" },
  SUBMITTED: { label: "Submitted", class: "badge-purple" },
  REVIEWING: { label: "Reviewing", class: "badge-warning" },
  APPROVED: { label: "Approved", class: "badge-success" },
  COMPLETED: { label: "Completed", class: "badge-success" },
  REVISION_REQUESTED: { label: "Revision", class: "badge-warning" },
  DISPUTED: { label: "Disputed", class: "badge-danger" },
  CANCELLED: { label: "Cancelled", class: "badge-danger" },
};

// ── Submit Work Modal ────────────────────────────────────────────────────────

function SubmitWorkModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [repoUrl, setRepoUrl] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-slide-up"
        style={{
          background: "var(--bg-card)", border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-lg)", padding: 32, width: 480,
        }}
      >
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Submit Work</h3>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>
          Paste your GitHub repo URL to start AI verification.
        </p>

        <label style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>
          Repository URL
        </label>
        <input
          type="url"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          placeholder="https://github.com/user/repo"
          style={{
            width: "100%", padding: "10px 14px", borderRadius: "var(--radius-md)",
            background: "var(--bg-secondary)", border: "1px solid var(--border-default)",
            color: "var(--text-primary)", fontSize: 14, outline: "none",
            fontFamily: "var(--font-mono)",
            marginBottom: 16,
          }}
        />

        <label style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>
          Worker Wallet Address
        </label>
        <input
          type="text"
          placeholder="Solana wallet public key"
          style={{
            width: "100%", padding: "10px 14px", borderRadius: "var(--radius-md)",
            background: "var(--bg-secondary)", border: "1px solid var(--border-default)",
            color: "var(--text-primary)", fontSize: 14, outline: "none",
            fontFamily: "var(--font-mono)",
            marginBottom: 24,
          }}
        />

        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              padding: "10px 20px", borderRadius: "var(--radius-md)",
              background: "transparent", border: "1px solid var(--border-default)",
              color: "var(--text-secondary)", fontSize: 13, fontWeight: 500, cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => { setLoading(true); setTimeout(() => { setLoading(false); onClose(); }, 1500); }}
            disabled={!repoUrl || loading}
            style={{
              padding: "10px 24px", borderRadius: "var(--radius-md)",
              background: loading ? "var(--bg-elevated)" : "var(--gradient-primary)",
              border: "none", color: "#06070a", fontSize: 13, fontWeight: 600,
              cursor: loading ? "wait" : "pointer", opacity: !repoUrl ? 0.5 : 1,
            }}
          >
            {loading ? "Submitting..." : "Submit & Verify"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Dashboard Page ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />

      <main style={{ flex: 1, marginLeft: 220, padding: "32px 40px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 4 }}>
              Dashboard
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
              AI-verified payment streaming overview
            </p>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            style={{
              padding: "10px 24px", borderRadius: "var(--radius-xl)",
              background: "var(--gradient-primary)", border: "none",
              color: "#06070a", fontSize: 13, fontWeight: 600, cursor: "pointer",
              boxShadow: "0 0 20px rgba(99,179,237,0.15)",
              transition: "transform 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
          >
            + New Task
          </button>
        </div>

        {/* Stat Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
          <StatCard
            title="Total Volume"
            value="16.3 SOL"
            trend={{ value: 12.5, label: "vs last week" }}
            accentColor="var(--accent-cyan)"
          />
          <StatCard
            title="Active Tasks"
            value="3"
            subtitle="reviewing"
            accentColor="var(--accent-blue)"
          />
          <StatCard
            title="Completed"
            value="12"
            trend={{ value: 8, label: "this month" }}
            accentColor="var(--accent-green)"
          />
          <StatCard
            title="Dispute Rate"
            value="4.2%"
            trend={{ value: -2.1, label: "improving" }}
            accentColor="var(--accent-orange)"
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24 }}>
          {/* Tasks List */}
          <div>
            <h2 style={{
              fontSize: 14, fontWeight: 600, color: "var(--text-secondary)",
              textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16,
            }}>
              Recent Tasks
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {MOCK_TASKS.map((task) => {
                const statusCfg = STATUS_CONFIG[task.status] ?? { label: task.status, class: "badge-info" };
                return (
                  <div
                    key={task.id}
                    className="animate-fade-in"
                    style={{
                      background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-lg)", padding: "20px 24px",
                      display: "flex", alignItems: "center", gap: 16,
                      transition: "all 0.15s ease", cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "var(--border-default)";
                      e.currentTarget.style.background = "var(--bg-elevated)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--border-subtle)";
                      e.currentTarget.style.background = "var(--bg-card)";
                    }}
                  >
                    {/* Score */}
                    <div style={{ flexShrink: 0 }}>
                      {task.score !== null ? (
                        <ScoreRing score={task.score} size={52} strokeWidth={5} />
                      ) : (
                        <div
                          style={{
                            width: 52, height: 52, borderRadius: "50%",
                            border: "2px dashed var(--text-muted)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 10, color: "var(--text-muted)",
                          }}
                        >
                          --
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {task.title}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-muted)" }}>
                        <span style={{ fontFamily: "var(--font-mono)" }}>{task.clientWallet}</span>
                        <span>-&gt;</span>
                        <span style={{ fontFamily: "var(--font-mono)" }}>{task.workerWallet}</span>
                        <span style={{ marginLeft: 4 }}>{task.createdAt}</span>
                      </div>
                    </div>

                    {/* Escrow */}
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-mono)" }}>
                        {task.escrowAmount} SOL
                      </div>
                      {task.decision && (
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                          {task.decision.replace("_", " ")}
                        </div>
                      )}
                    </div>

                    {/* Status */}
                    <span className={`badge ${statusCfg.class}`}>
                      {statusCfg.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Agent Panel */}
          <AgentStatusPanel agents={MOCK_AGENTS} />
        </div>
      </main>

      <SubmitWorkModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
