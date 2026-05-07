"use client";

import { useEffect, useRef, useState } from "react";

export interface AgentEvent {
  type: string;
  taskId: string;
  agent: string;
  message: string;
  data?: Record<string, unknown>;
  timestamp: number;
}

const AGENT_COLORS: Record<string, string> = {
  PIPELINE: "var(--text-secondary)",
  ARGUS: "var(--accent-cyan)",
  THEMIS: "var(--accent-purple)",
  DIKE: "var(--accent-blue)",
  CHRONOS: "var(--accent-orange)",
  KRATOS: "var(--accent-green)",
  NEMESIS: "var(--accent-red)",
  PLUTUS: "var(--accent-pink)",
};

const TYPE_ICONS: Record<string, string> = {
  pipeline_start: "🚀",
  pipeline_complete: "✅",
  agent_start: "▶",
  agent_progress: "⏳",
  agent_complete: "✓",
  agent_error: "✗",
  evidence_fetched: "📦",
};

export default function AgentLogPanel({
  events,
  isConnected,
}: {
  events: AgentEvent[];
  isConnected: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length]);

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-lg)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        height: "100%",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h3
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Agent Activity
          </h3>
          <span
            style={{
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              color: "var(--text-muted)",
              background: "var(--bg-secondary)",
              padding: "2px 8px",
              borderRadius: "var(--radius-sm)",
            }}
          >
            {events.length} events
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: isConnected ? "var(--accent-green)" : "var(--accent-red)",
              boxShadow: isConnected
                ? "0 0 8px var(--accent-green)"
                : "0 0 8px var(--accent-red)",
              animation: isConnected ? "pulse-glow 2s ease-in-out infinite" : "none",
            }}
          />
          <span
            style={{
              fontSize: 11,
              color: isConnected ? "var(--accent-green)" : "var(--accent-red)",
              fontWeight: 500,
            }}
          >
            {isConnected ? "Live" : "Disconnected"}
          </span>
        </div>
      </div>

      {/* Log Entries */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "8px 0",
          minHeight: 200,
          maxHeight: 500,
        }}
      >
        {events.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              minHeight: 200,
              color: "var(--text-muted)",
              fontSize: 13,
              gap: 8,
            }}
          >
            <span style={{ fontSize: 28, opacity: 0.4 }}>⚡</span>
            <span>Submit a GitHub URL to start agent verification</span>
            <span style={{ fontSize: 11, opacity: 0.7 }}>Real-time logs will appear here</span>
          </div>
        ) : (
          events.map((event, i) => {
            const agentColor = AGENT_COLORS[event.agent] ?? "var(--text-secondary)";
            const icon = TYPE_ICONS[event.type] ?? "•";
            const time = new Date(event.timestamp).toLocaleTimeString("en-US", {
              hour12: false,
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            });

            const isError = event.type === "agent_error";
            const isComplete =
              event.type === "agent_complete" || event.type === "pipeline_complete";
            const isStart =
              event.type === "agent_start" || event.type === "pipeline_start";

            return (
              <div
                key={`${event.timestamp}-${i}`}
                className="animate-fade-in"
                style={{
                  display: "flex",
                  gap: 10,
                  padding: "6px 16px",
                  fontSize: 12,
                  lineHeight: 1.5,
                  borderLeft: `2px solid ${isError ? "var(--accent-red)" : isComplete ? "var(--accent-green)" : isStart ? agentColor : "transparent"}`,
                  background:
                    event.type === "pipeline_complete"
                      ? "rgba(104, 211, 145, 0.04)"
                      : event.type === "pipeline_start"
                        ? "rgba(99, 179, 237, 0.04)"
                        : "transparent",
                  transition: "background 0.2s",
                }}
              >
                {/* Timestamp */}
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    color: "var(--text-muted)",
                    flexShrink: 0,
                    fontSize: 11,
                    minWidth: 60,
                    marginTop: 1,
                  }}
                >
                  {time}
                </span>

                {/* Icon */}
                <span
                  style={{
                    fontSize: 13,
                    flexShrink: 0,
                    width: 20,
                    textAlign: "center",
                    color: isError ? "var(--accent-red)" : isComplete ? "var(--accent-green)" : agentColor,
                  }}
                >
                  {icon}
                </span>

                {/* Agent badge */}
                <span
                  style={{
                    fontWeight: 700,
                    fontFamily: "var(--font-mono)",
                    color: agentColor,
                    flexShrink: 0,
                    fontSize: 11,
                    minWidth: 60,
                    marginTop: 1,
                  }}
                >
                  {event.agent}
                </span>

                {/* Message */}
                <span
                  style={{
                    color: isError
                      ? "var(--accent-red)"
                      : isComplete
                        ? "var(--text-primary)"
                        : "var(--text-secondary)",
                    fontWeight: isComplete || isStart ? 500 : 400,
                    flex: 1,
                  }}
                >
                  {event.message}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
