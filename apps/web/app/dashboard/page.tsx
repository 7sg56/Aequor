"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Sidebar from "../components/shared/Sidebar";
import StatCard from "../components/dashboard/StatCard";
import AgentStatusPanel from "../components/dashboard/AgentStatusPanel";
import AgentLogPanel, { type AgentEvent } from "../components/dashboard/AgentLogPanel";
import ScoreRing from "../components/shared/ScoreRing";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:4000";

// ── Types ────────────────────────────────────────────────────────────────────

interface TaskData {
  id: string;
  title: string;
  status: string;
  score: number | null;
  decision: string | null;
  clientWallet: string;
  workerWallet: string | null;
  escrowAmount: number;
  repoUrl: string | null;
  createdAt: string;
}

interface DashboardStats {
  totalTasks: number;
  activeTasks: number;
  completedTasks: number;
  disputeRate: number;
  totalVolume: number;
  agentAlerts: number;
}

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

// ── WebSocket Hook ───────────────────────────────────────────────────────────

function useWebSocket() {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    // Guard: only run on client
    if (typeof window === "undefined") return;
    
    // Don't create a new connection if one is already open/connecting
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const ws = new WebSocket(`${WS_BASE}/ws/events`);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
      };

      ws.onmessage = (e) => {
        try {
          const event: AgentEvent = JSON.parse(e.data);
          if (event.type && event.agent) {
            setEvents((prev) => [...prev, event]);
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;
        // Auto-reconnect after 3 seconds
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        // Only close if the socket is actually open
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      };
    } catch {
      // WebSocket not supported or URL error
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(connect, 5000);
    }
  }, []);

  useEffect(() => {
    // Small delay to ensure we're fully mounted on client
    const timer = setTimeout(connect, 100);
    return () => {
      clearTimeout(timer);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect on cleanup
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  const clearEvents = useCallback(() => setEvents([]), []);

  return { events, isConnected, clearEvents };
}

// ── Agent Status Tracking ────────────────────────────────────────────────────

function deriveAgentStatuses(events: AgentEvent[]) {
  const agents = [
    { name: "Argus", key: "ARGUS", role: "Evidence Fetcher + Audit Orchestrator" },
    { name: "Themis", key: "THEMIS", role: "Spec Compliance (Argus stream)" },
    { name: "Dike", key: "DIKE", role: "Code Quality (Argus stream)" },
    { name: "Chronos", key: "CHRONOS", role: "Timeliness (Argus stream)" },
    { name: "Kratos", key: "KRATOS", role: "Consensus Orchestrator" },
    { name: "Nemesis", key: "NEMESIS", role: "Dispute Arbiter" },
    { name: "Plutus", key: "PLUTUS", role: "Solana Payment Streamer" },
  ];

  return agents.map((agent) => {
    const agentEvents = events.filter((e) => e.agent === agent.key);
    const lastEvent = agentEvents[agentEvents.length - 1];
    let status: "active" | "idle" | "processing" | "error" = "idle";
    let lastScore: number | undefined;

    if (lastEvent) {
      if (lastEvent.type === "agent_start") status = "processing";
      else if (lastEvent.type === "agent_progress") status = "processing";
      else if (lastEvent.type === "agent_complete") status = "active";
      else if (lastEvent.type === "agent_error") status = "error";

      if (lastEvent.data?.score !== undefined) {
        lastScore = lastEvent.data.score as number;
      }
    }

    return { name: agent.name, role: agent.role, status, lastScore };
  });
}

// ── Dashboard Page ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [isVerifying, setIsVerifying] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Live data
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loadingTasks, setLoadingTasks] = useState(true);

  // WebSocket
  const { events, isConnected, clearEvents } = useWebSocket();

  // Derived agent statuses from WebSocket events
  const agentStatuses = deriveAgentStatuses(events);

  // ── Fetch Data ──────────────────────────────────────────────────────────────

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/tasks?limit=20`);
      const json = await res.json();
      if (json.success) setTasks(json.data);
    } catch {
      // API not available
    } finally {
      setLoadingTasks(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/dashboard/stats`);
      const json = await res.json();
      if (json.success) setStats(json.data);
    } catch {
      // API not available
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    fetchStats();
  }, [fetchTasks, fetchStats]);

  // Refresh tasks when pipeline completes
  useEffect(() => {
    const lastEvent = events[events.length - 1];
    if (lastEvent?.type === "pipeline_complete") {
      // Delay slightly so DB is updated
      setTimeout(() => {
        fetchTasks();
        fetchStats();
      }, 1000);
    }
  }, [events, fetchTasks, fetchStats]);

  // ── Quick Verify Handler ────────────────────────────────────────────────────

  const handleQuickVerify = async () => {
    if (!repoUrl) return;
    setError(null);
    setIsVerifying(true);
    clearEvents();

    try {
      const res = await fetch(`${API_BASE}/api/tasks/quick-verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl, branch }),
      });
      const json = await res.json();

      if (json.success) {
        setCurrentTaskId(json.data.taskId);
        // Task list will refresh via pipeline_complete event
      } else {
        setError(json.error?.message || "Failed to start verification");
        setIsVerifying(false);
      }
    } catch (err) {
      setError("Cannot connect to API. Make sure the backend is running on port 4000.");
      setIsVerifying(false);
    }
  };

  // Reset verify state when pipeline completes
  useEffect(() => {
    const lastEvent = events[events.length - 1];
    if (lastEvent?.type === "pipeline_complete" && currentTaskId) {
      setIsVerifying(false);
    }
  }, [events, currentTaskId]);

  // ── Render ──────────────────────────────────────────────────────────────────

  const pipelineComplete = events.some((e) => e.type === "pipeline_complete");
  const pipelineScore = pipelineComplete
    ? (events.find((e) => e.type === "pipeline_complete")?.data?.score as number | undefined)
    : undefined;
  const pipelineDecision = pipelineComplete
    ? (events.find((e) => e.type === "pipeline_complete")?.data?.decision as string | undefined)
    : undefined;

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />

      <main style={{ flex: 1, marginLeft: 220, padding: "32px 40px" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 32,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: "-0.03em",
                marginBottom: 4,
              }}
            >
              Dashboard
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
              AI-verified payment streaming overview
            </p>
          </div>
        </div>

        {/* ── GitHub URL Input ─────────────────────────────────────────────── */}
        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-lg)",
            padding: "28px 32px",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 16,
            }}
          >
            <span style={{ fontSize: 18 }}>🔍</span>
            <h2
              style={{
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: "-0.02em",
              }}
            >
              Verify a GitHub Repository
            </h2>
          </div>
          <p
            style={{
              fontSize: 13,
              color: "var(--text-muted)",
              marginBottom: 20,
              lineHeight: 1.5,
            }}
          >
            Paste a GitHub repo URL below. Argus will fetch evidence, run AI
            audit streams (Themis, Dike, Chronos), and Kratos will compute a
            consensus score — all in real-time.
          </p>

          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "flex-end",
            }}
          >
            <div style={{ flex: 1 }}>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                  marginBottom: 6,
                  display: "block",
                }}
              >
                Repository URL
              </label>
              <input
                id="repo-url-input"
                type="url"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/user/repo"
                disabled={isVerifying}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && repoUrl) handleQuickVerify();
                }}
                style={{
                  width: "100%",
                  padding: "11px 16px",
                  borderRadius: "var(--radius-md)",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-default)",
                  color: "var(--text-primary)",
                  fontSize: 14,
                  outline: "none",
                  fontFamily: "var(--font-mono)",
                  transition: "border-color 0.15s",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--accent-blue)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-default)";
                }}
              />
            </div>

            <div style={{ width: 140 }}>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                  marginBottom: 6,
                  display: "block",
                }}
              >
                Branch
              </label>
              <input
                id="branch-input"
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="main"
                disabled={isVerifying}
                style={{
                  width: "100%",
                  padding: "11px 16px",
                  borderRadius: "var(--radius-md)",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-default)",
                  color: "var(--text-primary)",
                  fontSize: 14,
                  outline: "none",
                  fontFamily: "var(--font-mono)",
                }}
              />
            </div>

            <button
              id="verify-button"
              onClick={handleQuickVerify}
              disabled={!repoUrl || isVerifying}
              style={{
                padding: "11px 28px",
                borderRadius: "var(--radius-md)",
                background:
                  isVerifying
                    ? "var(--bg-elevated)"
                    : "var(--gradient-primary)",
                border: "none",
                color: isVerifying ? "var(--text-muted)" : "#06070a",
                fontSize: 13,
                fontWeight: 600,
                cursor:
                  !repoUrl || isVerifying ? "not-allowed" : "pointer",
                opacity: !repoUrl ? 0.5 : 1,
                transition: "all 0.15s",
                boxShadow: isVerifying
                  ? "none"
                  : "0 0 20px rgba(99,179,237,0.15)",
                whiteSpace: "nowrap",
                minWidth: 140,
              }}
              onMouseEnter={(e) => {
                if (!isVerifying && repoUrl)
                  e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              {isVerifying ? (
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      border: "2px solid var(--text-muted)",
                      borderTopColor: "var(--accent-blue)",
                      borderRadius: "50%",
                      display: "inline-block",
                      animation: "spin-slow 1s linear infinite",
                    }}
                  />
                  Verifying...
                </span>
              ) : (
                "⚡ Verify Now"
              )}
            </button>
          </div>

          {error && (
            <div
              style={{
                marginTop: 12,
                padding: "10px 14px",
                borderRadius: "var(--radius-md)",
                background: "rgba(252,129,129,0.08)",
                border: "1px solid rgba(252,129,129,0.2)",
                color: "var(--accent-red)",
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          {/* Quick Result Banner */}
          {pipelineComplete && pipelineScore !== undefined && (
            <div
              className="animate-slide-up"
              style={{
                marginTop: 16,
                padding: "16px 20px",
                borderRadius: "var(--radius-md)",
                background:
                  pipelineScore >= 80
                    ? "rgba(104,211,145,0.08)"
                    : pipelineScore >= 60
                      ? "rgba(246,173,85,0.08)"
                      : "rgba(252,129,129,0.08)",
                border: `1px solid ${
                  pipelineScore >= 80
                    ? "rgba(104,211,145,0.2)"
                    : pipelineScore >= 60
                      ? "rgba(246,173,85,0.2)"
                      : "rgba(252,129,129,0.2)"
                }`,
                display: "flex",
                alignItems: "center",
                gap: 16,
              }}
            >
              <ScoreRing score={pipelineScore} size={56} strokeWidth={5} />
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>
                  Verification Complete — Score: {pipelineScore}/100
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--text-secondary)",
                    marginTop: 2,
                  }}
                >
                  Decision: {pipelineDecision?.replace("_", " ") ?? "—"}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Stat Cards ──────────────────────────────────────────────────── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 16,
            marginBottom: 24,
          }}
        >
          <StatCard
            title="Total Volume"
            value={stats ? `${stats.totalVolume.toFixed(1)} SOL` : "—"}
            accentColor="var(--accent-cyan)"
          />
          <StatCard
            title="Active Tasks"
            value={stats?.activeTasks?.toString() ?? "—"}
            subtitle="reviewing"
            accentColor="var(--accent-blue)"
          />
          <StatCard
            title="Completed"
            value={stats?.completedTasks?.toString() ?? "—"}
            accentColor="var(--accent-green)"
          />
          <StatCard
            title="Dispute Rate"
            value={
              stats ? `${(stats.disputeRate * 100).toFixed(1)}%` : "—"
            }
            accentColor="var(--accent-orange)"
          />
        </div>

        {/* ── Main Grid: Log + Agent Panel ─────────────────────────────────── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 340px",
            gap: 24,
            marginBottom: 32,
          }}
        >
          {/* Agent Log Panel */}
          <AgentLogPanel events={events} isConnected={isConnected} />

          {/* Agent Status Panel */}
          <AgentStatusPanel agents={agentStatuses} />
        </div>

        {/* ── Recent Tasks ────────────────────────────────────────────────── */}
        <div>
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
            Recent Tasks
          </h2>

          {loadingTasks ? (
            <div
              style={{
                padding: 40,
                textAlign: "center",
                color: "var(--text-muted)",
                fontSize: 13,
              }}
            >
              Loading tasks...
            </div>
          ) : tasks.length === 0 ? (
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
              No tasks yet. Submit a GitHub URL above to create your first
              verification.
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {tasks.map((task) => {
                const statusCfg = STATUS_CONFIG[task.status] ?? {
                  label: task.status,
                  class: "badge-info",
                };
                const timeAgo = getTimeAgo(task.createdAt);
                return (
                  <div
                    key={task.id}
                    className="animate-fade-in"
                    style={{
                      background: "var(--bg-card)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-lg)",
                      padding: "20px 24px",
                      display: "flex",
                      alignItems: "center",
                      gap: 16,
                      transition: "all 0.15s ease",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor =
                        "var(--border-default)";
                      e.currentTarget.style.background =
                        "var(--bg-elevated)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor =
                        "var(--border-subtle)";
                      e.currentTarget.style.background = "var(--bg-card)";
                    }}
                  >
                    {/* Score */}
                    <div style={{ flexShrink: 0 }}>
                      {task.score !== null ? (
                        <ScoreRing
                          score={task.score}
                          size={52}
                          strokeWidth={5}
                        />
                      ) : (
                        <div
                          style={{
                            width: 52,
                            height: 52,
                            borderRadius: "50%",
                            border: "2px dashed var(--text-muted)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 10,
                            color: "var(--text-muted)",
                          }}
                        >
                          {task.status === "REVIEWING" ? (
                            <span
                              style={{
                                width: 16,
                                height: 16,
                                border: "2px solid var(--text-muted)",
                                borderTopColor: "var(--accent-blue)",
                                borderRadius: "50%",
                                display: "inline-block",
                                animation: "spin-slow 1s linear infinite",
                              }}
                            />
                          ) : (
                            "--"
                          )}
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          marginBottom: 4,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {task.title}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          fontSize: 12,
                          color: "var(--text-muted)",
                        }}
                      >
                        {task.repoUrl && (
                          <span
                            style={{
                              fontFamily: "var(--font-mono)",
                              maxWidth: 300,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {task.repoUrl.replace("https://github.com/", "")}
                          </span>
                        )}
                        <span style={{ marginLeft: 4 }}>{timeAgo}</span>
                      </div>
                    </div>

                    {/* Escrow */}
                    {task.escrowAmount > 0 && (
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div
                          style={{
                            fontSize: 15,
                            fontWeight: 700,
                            fontFamily: "var(--font-mono)",
                          }}
                        >
                          {task.escrowAmount} SOL
                        </div>
                        {task.decision && (
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--text-muted)",
                              marginTop: 2,
                            }}
                          >
                            {task.decision.replace("_", " ")}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Decision badge for quick-verify tasks */}
                    {task.decision && task.escrowAmount === 0 && (
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          fontFamily: "var(--font-mono)",
                          color:
                            task.decision === "AUTO_RELEASE"
                              ? "var(--accent-green)"
                              : task.decision === "MANUAL_REVIEW"
                                ? "var(--accent-orange)"
                                : "var(--accent-red)",
                        }}
                      >
                        {task.score !== null && `${Math.round(task.score)}/100`}
                      </div>
                    )}

                    {/* Status */}
                    <span className={`badge ${statusCfg.class}`}>
                      {statusCfg.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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
