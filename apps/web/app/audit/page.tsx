"use client";

import { useState } from "react";
import Sidebar from "../components/shared/Sidebar";
import ScoreRing from "../components/shared/ScoreRing";

// ── Mock Audit Data ──────────────────────────────────────────────────────────

const MOCK_REPORTS = [
  {
    id: "rpt_1",
    taskTitle: "Build REST API for user management",
    agentName: "ARGUS",
    score: 82,
    severity: "INFO",
    summary: "Objective evidence score: 82/100. 12 commits, 3 PRs, 24 files changed.",
    timestamp: "2 hours ago",
    breakdown: { commitScore: 25, prScore: 20, codeVolume: 22, fileScore: 10, testScore: 5 },
  },
  {
    id: "rpt_2",
    taskTitle: "Build REST API for user management",
    agentName: "THEMIS",
    score: 76,
    severity: "MEDIUM",
    summary: "Spec compliance partial: auth endpoints implemented, pagination missing.",
    timestamp: "2 hours ago",
    breakdown: null,
  },
  {
    id: "rpt_3",
    taskTitle: "Build REST API for user management",
    agentName: "DIKE",
    score: 88,
    severity: "INFO",
    summary: "Code quality strong: good separation, conventional commits, typed routes.",
    timestamp: "2 hours ago",
    breakdown: null,
  },
  {
    id: "rpt_4",
    taskTitle: "Build REST API for user management",
    agentName: "CHRONOS",
    score: 91,
    severity: "INFO",
    summary: "On time, steady cadence, 5 active days over 7-day period.",
    timestamp: "2 hours ago",
    breakdown: null,
  },
  {
    id: "rpt_5",
    taskTitle: "Build REST API for user management",
    agentName: "KRATOS",
    score: 84,
    severity: "INFO",
    summary: "Consensus: 84/100 -- AUTO RELEASE. Weighted: 40% objective (82) + 60% AI avg (85).",
    timestamp: "2 hours ago",
    breakdown: null,
  },
  {
    id: "rpt_6",
    taskTitle: "Build REST API for user management",
    agentName: "PLUTUS",
    score: 100,
    severity: "INFO",
    summary: "Payment of 2.5 SOL streamed to 9mNb...k2Rj. TX: tx_abc123.",
    timestamp: "2 hours ago",
    breakdown: null,
  },
  {
    id: "rpt_7",
    taskTitle: "Smart contract audit and testing",
    agentName: "ARGUS",
    score: 58,
    severity: "MEDIUM",
    summary: "Objective evidence score: 58/100. 4 commits, 0 PRs, 8 files changed.",
    timestamp: "2 days ago",
    breakdown: { commitScore: 20, prScore: 0, codeVolume: 18, fileScore: 10, testScore: 10 },
  },
  {
    id: "rpt_8",
    taskTitle: "Smart contract audit and testing",
    agentName: "KRATOS",
    score: 62,
    severity: "MEDIUM",
    summary: "Consensus: 62/100 -- MANUAL REVIEW. Code quality flagged by Dike.",
    timestamp: "2 days ago",
    breakdown: null,
  },
];

const MOCK_AUDIT_LOG = [
  { action: "task_created", actor: "7xKX...q3Fp", target: "tsk_1", time: "3 days ago" },
  { action: "work_submitted", actor: "9mNb...k2Rj", target: "tsk_1", time: "2 days ago" },
  { action: "verification_started", actor: "ARGUS", target: "tsk_1", time: "2 hours ago" },
  { action: "consensus_reached", actor: "KRATOS", target: "tsk_1", time: "2 hours ago" },
  { action: "payment_released", actor: "PLUTUS", target: "tsk_1", time: "2 hours ago" },
  { action: "task_created", actor: "3bGk...n7Qs", target: "tsk_4", time: "3 days ago" },
  { action: "consensus_reached", actor: "KRATOS", target: "tsk_4", time: "2 days ago" },
];

const AGENT_COLORS: Record<string, string> = {
  ARGUS: "var(--accent-cyan)",
  THEMIS: "var(--accent-purple)",
  DIKE: "var(--accent-blue)",
  CHRONOS: "var(--accent-orange)",
  KRATOS: "var(--accent-green)",
  NEMESIS: "var(--accent-red)",
  PLUTUS: "var(--accent-pink)",
};

const SEVERITY_BADGE: Record<string, string> = {
  INFO: "badge-info",
  LOW: "badge-info",
  MEDIUM: "badge-warning",
  HIGH: "badge-danger",
  CRITICAL: "badge-danger",
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AuditPage() {
  const [filter, setFilter] = useState<string>("all");

  const filteredReports =
    filter === "all"
      ? MOCK_REPORTS
      : MOCK_REPORTS.filter((r) => r.agentName === filter);

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />

      <main style={{ flex: 1, marginLeft: 220, padding: "32px 40px" }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 4 }}>
            Audit Trail
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
            Complete agent report history and verification logs
          </p>
        </div>

        {/* Agent Filter Chips */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
          {["all", "ARGUS", "THEMIS", "DIKE", "CHRONOS", "KRATOS", "NEMESIS", "PLUTUS"].map(
            (name) => (
              <button
                key={name}
                onClick={() => setFilter(name)}
                style={{
                  padding: "6px 14px",
                  borderRadius: "var(--radius-xl)",
                  border:
                    filter === name
                      ? `1px solid ${AGENT_COLORS[name] ?? "var(--accent-blue)"}`
                      : "1px solid var(--border-subtle)",
                  background:
                    filter === name
                      ? `${AGENT_COLORS[name] ?? "var(--accent-blue)"}15`
                      : "transparent",
                  color:
                    filter === name
                      ? AGENT_COLORS[name] ?? "var(--accent-blue)"
                      : "var(--text-secondary)",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {name === "all" ? "All Agents" : name}
              </button>
            )
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24 }}>
          {/* Report List */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filteredReports.map((report) => (
              <div
                key={report.id}
                className="animate-fade-in"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-lg)",
                  padding: "20px 24px",
                  borderLeft: `3px solid ${AGENT_COLORS[report.agentName] ?? "var(--accent-blue)"}`,
                  transition: "all 0.15s",
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
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 10,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        fontFamily: "var(--font-mono)",
                        color: AGENT_COLORS[report.agentName],
                      }}
                    >
                      {report.agentName}
                    </span>
                    <span className={`badge ${SEVERITY_BADGE[report.severity] ?? "badge-info"}`}>
                      {report.severity}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <ScoreRing score={report.score} size={40} strokeWidth={4} />
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--text-muted)",
                      }}
                    >
                      {report.timestamp}
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    marginBottom: 4,
                  }}
                >
                  {report.taskTitle}
                </div>
                <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
                  {report.summary}
                </p>

                {report.breakdown && (
                  <div
                    style={{
                      marginTop: 12,
                      display: "flex",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    {Object.entries(report.breakdown).map(([key, val]) => (
                      <div
                        key={key}
                        style={{
                          padding: "4px 10px",
                          borderRadius: "var(--radius-sm)",
                          background: "var(--bg-secondary)",
                          fontSize: 11,
                          fontFamily: "var(--font-mono)",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {key}: {val}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Activity Log */}
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-lg)",
              padding: 24,
              height: "fit-content",
              position: "sticky",
              top: 32,
            }}
          >
            <h3
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--text-secondary)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: 16,
              }}
            >
              Activity Log
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {MOCK_AUDIT_LOG.map((entry, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 12,
                    padding: "10px 0",
                    borderBottom:
                      i < MOCK_AUDIT_LOG.length - 1
                        ? "1px solid var(--border-subtle)"
                        : "none",
                  }}
                >
                  {/* Timeline dot */}
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "var(--accent-blue)",
                      marginTop: 5,
                      flexShrink: 0,
                      opacity: 0.6,
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: "var(--text-primary)",
                        marginBottom: 2,
                      }}
                    >
                      {entry.action.replace(/_/g, " ")}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-muted)",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {entry.actor} &rarr; {entry.target}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>
                    {entry.time}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
