"use client";

interface AgentStatusProps {
  agents: Array<{
    name: string;
    role: string;
    status: "active" | "idle" | "processing" | "error";
    lastScore?: number;
  }>;
}

const STATUS_COLORS: Record<string, string> = {
  active: "var(--accent-green)",
  idle: "var(--text-muted)",
  processing: "var(--accent-blue)",
  error: "var(--accent-red)",
};

export default function AgentStatusPanel({ agents }: AgentStatusProps) {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-lg)",
        padding: "24px",
      }}
    >
      <h3
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: "var(--text-secondary)",
          marginBottom: 16,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        Agent Swarm
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {agents.map((agent) => (
          <div
            key={agent.name}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 14px",
              borderRadius: "var(--radius-md)",
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-subtle)",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--border-default)";
              e.currentTarget.style.background = "var(--bg-elevated)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border-subtle)";
              e.currentTarget.style.background = "var(--bg-secondary)";
            }}
          >
            {/* Status dot */}
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: STATUS_COLORS[agent.status],
                boxShadow: agent.status === "processing"
                  ? `0 0 8px ${STATUS_COLORS[agent.status]}`
                  : "none",
                animation: agent.status === "processing" ? "pulse-glow 2s ease-in-out infinite" : "none",
                flexShrink: 0,
              }}
            />

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                {agent.name}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {agent.role}
              </div>
            </div>

            {agent.lastScore !== undefined && (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: "var(--font-mono)",
                  color: agent.lastScore >= 80
                    ? "var(--accent-green)"
                    : agent.lastScore >= 60
                      ? "var(--accent-orange)"
                      : "var(--accent-red)",
                }}
              >
                {agent.lastScore}
              </span>
            )}

            <span
              className="badge"
              style={{
                background: `${STATUS_COLORS[agent.status]}15`,
                color: STATUS_COLORS[agent.status],
                border: `1px solid ${STATUS_COLORS[agent.status]}30`,
                fontSize: 10,
                padding: "2px 8px",
              }}
            >
              {agent.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
