"use client";

import { useState, useEffect, useCallback } from "react";
import Sidebar from "../components/shared/Sidebar";
import ScoreRing from "../components/shared/ScoreRing";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// ── Types ────────────────────────────────────────────────────────────────────

interface AgentReport {
  id: string;
  taskId: string;
  agentName: string;
  score: number;
  confidence: number;
  severity: string;
  summary: string;
  reasoning: string | null;
  details: any;
  recommendations: string[];
  createdAt: string;
}

interface AuditLogEntry {
  id: string;
  action: string;
  actor: string;
  target: string;
  details: any;
  createdAt: string;
}

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

function getTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AuditPage() {
  const [filter, setFilter] = useState<string>("all");
  const [reports, setReports] = useState<AgentReport[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [reportsRes, logRes] = await Promise.all([
        fetch(`${API_BASE}/api/dashboard/recent-activity`),
        fetch(`${API_BASE}/api/audit-log?limit=20`),
      ]);
      const reportsJson = await reportsRes.json();
      const logJson = await logRes.json();

      if (reportsJson.success) {
        setReports(reportsJson.data.recentReports ?? []);
      }
      if (logJson.success) {
        setAuditLog(logJson.data ?? []);
      }
    } catch {
      // API not available
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Poll every 10s for new data
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const filteredReports =
    filter === "all"
      ? reports
      : reports.filter((r) => r.agentName === filter);

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

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            Loading audit data...
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24 }}>
            {/* Report List */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filteredReports.length === 0 ? (
                <div
                  style={{
                    padding: 40,
                    textAlign: "center",
                    color: "var(--text-muted)",
                    fontSize: 13,
                    background: "var(--bg-card)",
                    borderRadius: "var(--radius-lg)",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  No agent reports yet. Run a verification from the dashboard to see reports here.
                </div>
              ) : (
                filteredReports.map((report) => (
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
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                          {getTimeAgo(report.createdAt)}
                        </span>
                      </div>
                    </div>

                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--text-secondary)",
                        marginBottom: 4,
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      Task: {report.taskId.slice(0, 12)}...
                    </div>
                    <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
                      {report.summary}
                    </p>

                    {report.recommendations && report.recommendations.length > 0 && (
                      <div style={{ marginTop: 10 }}>
                        {report.recommendations.map((rec, i) => (
                          <div
                            key={i}
                            style={{
                              padding: "4px 10px",
                              borderRadius: "var(--radius-sm)",
                              background: "var(--bg-secondary)",
                              fontSize: 11,
                              color: "var(--text-secondary)",
                              marginBottom: 4,
                              display: "inline-block",
                              marginRight: 8,
                            }}
                          >
                            → {rec}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
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
                {auditLog.length === 0 ? (
                  <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "16px 0" }}>
                    No activity yet
                  </div>
                ) : (
                  auditLog.map((entry, i) => (
                    <div
                      key={entry.id}
                      style={{
                        display: "flex",
                        gap: 12,
                        padding: "10px 0",
                        borderBottom:
                          i < auditLog.length - 1
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
                          background: AGENT_COLORS[entry.actor] ?? "var(--accent-blue)",
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
                          {entry.actor} → {entry.target.slice(0, 12)}...
                        </div>
                      </div>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>
                        {getTimeAgo(entry.createdAt)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
