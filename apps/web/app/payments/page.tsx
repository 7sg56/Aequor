"use client";

import Sidebar from "../components/shared/Sidebar";

const MOCK_PAYMENTS = [
  {
    id: "pay_1",
    taskTitle: "Build REST API for user management",
    from: "7xKX...q3Fp",
    to: "9mNb...k2Rj",
    amount: 2.5,
    status: "COMPLETED",
    txSignature: "tx_lq8x...3mfp",
    streamRate: "0.00069 SOL/s",
    startedAt: "2h ago",
    completedAt: "1h ago",
  },
  {
    id: "pay_2",
    taskTitle: "Implement WebSocket notification system",
    from: "4pLm...x8Wy",
    to: "2kFn...j5Ht",
    amount: 4.0,
    status: "PENDING",
    txSignature: null,
    streamRate: null,
    startedAt: null,
    completedAt: null,
  },
  {
    id: "pay_3",
    taskTitle: "Smart contract audit and testing",
    from: "3bGk...n7Qs",
    to: "8wYp...f4Lx",
    amount: 8.0,
    status: "PENDING",
    txSignature: null,
    streamRate: null,
    startedAt: null,
    completedAt: null,
  },
];

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  PENDING: { bg: "rgba(246,173,85,0.1)", color: "var(--accent-orange)", label: "Pending" },
  STREAMING: { bg: "rgba(99,179,237,0.1)", color: "var(--accent-blue)", label: "Streaming" },
  COMPLETED: { bg: "rgba(104,211,145,0.1)", color: "var(--accent-green)", label: "Completed" },
  FAILED: { bg: "rgba(252,129,129,0.1)", color: "var(--accent-red)", label: "Failed" },
  REFUNDED: { bg: "rgba(183,148,244,0.1)", color: "var(--accent-purple)", label: "Refunded" },
};

export default function PaymentsPage() {
  const totalEscrowed = MOCK_PAYMENTS.reduce((s, p) => s + p.amount, 0);
  const totalReleased = MOCK_PAYMENTS.filter((p) => p.status === "COMPLETED").reduce((s, p) => s + p.amount, 0);
  const pending = MOCK_PAYMENTS.filter((p) => p.status === "PENDING").length;

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />

      <main style={{ flex: 1, marginLeft: 220, padding: "32px 40px" }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 4 }}>
            Payments
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
            Solana escrow and streamed payment tracking
          </p>
        </div>

        {/* Summary Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 32 }}>
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-lg)",
              padding: 24,
            }}
          >
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>Total Escrowed</div>
            <div style={{ fontSize: 32, fontWeight: 700, fontFamily: "var(--font-mono)" }} className="gradient-text">
              {totalEscrowed} SOL
            </div>
          </div>

          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-lg)",
              padding: 24,
            }}
          >
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>Released</div>
            <div style={{ fontSize: 32, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--accent-green)" }}>
              {totalReleased} SOL
            </div>
          </div>

          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-lg)",
              padding: 24,
            }}
          >
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>Pending Review</div>
            <div style={{ fontSize: 32, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--accent-orange)" }}>
              {pending}
            </div>
          </div>
        </div>

        {/* Payment List */}
        <h2
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--text-secondary)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: 16,
          }}
        >
          Payment History
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {MOCK_PAYMENTS.map((pay) => {
            const st = STATUS_STYLES[pay.status] ?? STATUS_STYLES["PENDING"]!;
            return (
              <div
                key={pay.id}
                className="animate-fade-in"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-lg)",
                  padding: "20px 24px",
                  display: "grid",
                  gridTemplateColumns: "1fr auto auto auto",
                  alignItems: "center",
                  gap: 24,
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--bg-elevated)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "var(--bg-card)";
                }}
              >
                {/* Task Info */}
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                    {pay.taskTitle}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                    {pay.from} &rarr; {pay.to}
                  </div>
                </div>

                {/* Amount */}
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--font-mono)" }}>
                    {pay.amount} SOL
                  </div>
                  {pay.streamRate && (
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {pay.streamRate}
                    </div>
                  )}
                </div>

                {/* TX */}
                <div style={{ minWidth: 100 }}>
                  {pay.txSignature ? (
                    <div
                      style={{
                        fontSize: 11,
                        fontFamily: "var(--font-mono)",
                        color: "var(--accent-blue)",
                        padding: "4px 10px",
                        borderRadius: "var(--radius-sm)",
                        background: "rgba(99,179,237,0.08)",
                        cursor: "pointer",
                      }}
                    >
                      {pay.txSignature}
                    </div>
                  ) : (
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>No TX yet</span>
                  )}
                </div>

                {/* Status */}
                <span
                  className="badge"
                  style={{
                    background: st.bg,
                    color: st.color,
                    border: `1px solid ${st.color}30`,
                  }}
                >
                  {st.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Escrow Explanation */}
        <div
          style={{
            marginTop: 40,
            padding: 24,
            background: "var(--bg-card)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-lg)",
          }}
        >
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>How Aequor Payments Work</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
            <div>
              <div style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>1. Escrow Lock</div>
              Client locks SOL into an on-chain escrow when creating a task. Funds are held by the Aequor smart contract.
            </div>
            <div>
              <div style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>2. AI Verification</div>
              Argus agent swarm audits submitted work. Score &gt;=80 triggers auto-release via Plutus.
            </div>
            <div>
              <div style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>3. Streamed Payout</div>
              Plutus streams SOL to the worker over time, allowing both parties to monitor real-time flow.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
