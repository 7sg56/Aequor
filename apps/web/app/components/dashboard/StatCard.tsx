"use client";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: { value: number; label: string };
  accentColor?: string;
}

export default function StatCard({ title, value, subtitle, icon, trend, accentColor = "var(--accent-blue)" }: StatCardProps) {
  return (
    <div
      className="animate-fade-in"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-lg)",
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        transition: "all 0.2s ease",
        cursor: "default",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = `${accentColor}33`;
        e.currentTarget.style.boxShadow = `0 0 20px ${accentColor}10`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border-subtle)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }}>
          {title}
        </span>
        {icon && (
          <div style={{ color: accentColor, opacity: 0.7 }}>
            {icon}
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--text-primary)" }}>
          {value}
        </span>
        {subtitle && (
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {subtitle}
          </span>
        )}
      </div>

      {trend && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
          <span style={{ color: trend.value >= 0 ? "var(--accent-green)" : "var(--accent-red)", fontWeight: 600 }}>
            {trend.value >= 0 ? "+" : ""}{trend.value}%
          </span>
          <span style={{ color: "var(--text-muted)" }}>{trend.label}</span>
        </div>
      )}
    </div>
  );
}
