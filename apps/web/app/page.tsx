"use client";

import Link from "next/link";

const AGENTS = [
  { name: "Argus", role: "Evidence Fetcher", desc: "Pulls GitHub commits, PRs, files, tests. Runs audit streams." },
  { name: "Themis", role: "Spec Compliance", desc: "Checks deliverables against original requirements." },
  { name: "Dike", role: "Code Quality", desc: "Reviews structure, patterns, security, and testing." },
  { name: "Chronos", role: "Timeliness", desc: "Analyzes commit cadence and deadline adherence." },
  { name: "Kratos", role: "Consensus", desc: "Weighs all signals to produce final score and decision." },
  { name: "Nemesis", role: "Dispute Arbiter", desc: "Reviews audit trail when client and worker disagree." },
  { name: "Plutus", role: "Payment Stream", desc: "Executes Solana payouts, milestone release, and escrow." },
];

const FLOW_STEPS = [
  { num: "01", title: "Create Task", desc: "Client defines requirements and locks SOL in escrow" },
  { num: "02", title: "Submit Work", desc: "Worker submits GitHub repo URL as proof of work" },
  { num: "03", title: "AI Swarm Audits", desc: "Argus fetches evidence, spawns audit streams via Groq" },
  { num: "04", title: "Consensus Score", desc: "Kratos computes 40% objective + 60% AI reasoning" },
  { num: "05", title: "Auto Payment", desc: "Score 80+ triggers Plutus to stream SOL to worker" },
];

export default function Home() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
      {/* ── Navbar ───────────────────────────────────────────────────────────── */}
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          padding: "0 40px",
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid var(--border-subtle)",
        }}
        className="glass"
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: "var(--gradient-primary)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700, fontSize: 14, color: "#06070a",
            }}
          >
            Ae
          </div>
          <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: "-0.03em" }}>
            Aequor
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <Link href="/dashboard" style={{ color: "var(--text-secondary)", textDecoration: "none", fontSize: 14, fontWeight: 500 }}>
            Dashboard
          </Link>
          <Link
            href="/dashboard"
            style={{
              padding: "8px 20px", borderRadius: "var(--radius-xl)",
              background: "var(--gradient-primary)", color: "#06070a",
              textDecoration: "none", fontSize: 13, fontWeight: 600,
              transition: "opacity 0.15s",
            }}
          >
            Launch App
          </Link>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section
        style={{
          paddingTop: 160, paddingBottom: 120,
          textAlign: "center",
          position: "relative", overflow: "hidden",
        }}
      >
        {/* Background glow */}
        <div
          style={{
            position: "absolute", top: -200, left: "50%", transform: "translateX(-50%)",
            width: 800, height: 800,
            background: "radial-gradient(circle, rgba(99,179,237,0.08) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <div className="animate-slide-up" style={{ position: "relative", zIndex: 1 }}>
          <div
            className="badge badge-info"
            style={{ marginBottom: 24, display: "inline-flex" }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent-cyan)", display: "inline-block" }} />
            Built on Solana Devnet
          </div>

          <h1 style={{
            fontSize: 64, fontWeight: 800, letterSpacing: "-0.04em",
            lineHeight: 1.1, maxWidth: 800, margin: "0 auto 24px",
          }}>
            AI-Verified{" "}
            <span className="gradient-text">Freelance Payments</span>
            {" "}on Solana
          </h1>

          <p style={{
            fontSize: 18, color: "var(--text-secondary)",
            maxWidth: 580, margin: "0 auto 40px", lineHeight: 1.6,
          }}>
            Multi-agent work verification with conditional payment streaming.
            Evidence-based audits. Automated escrow release. Zero trust gap.
          </p>

          <div style={{ display: "flex", justifyContent: "center", gap: 16 }}>
            <Link
              href="/dashboard"
              style={{
                padding: "14px 32px", borderRadius: "var(--radius-xl)",
                background: "var(--gradient-primary)", color: "#06070a",
                textDecoration: "none", fontSize: 15, fontWeight: 600,
                boxShadow: "0 0 30px rgba(99,179,237,0.2)",
                transition: "transform 0.15s, box-shadow 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 0 40px rgba(99,179,237,0.35)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 0 30px rgba(99,179,237,0.2)"; }}
            >
              Open Dashboard
            </Link>
            <a
              href="https://github.com"
              style={{
                padding: "14px 32px", borderRadius: "var(--radius-xl)",
                border: "1px solid var(--border-default)", color: "var(--text-secondary)",
                textDecoration: "none", fontSize: 15, fontWeight: 500,
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent-blue)"; e.currentTarget.style.color = "var(--text-primary)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-default)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
            >
              View Source
            </a>
          </div>
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────────────────────────── */}
      <section style={{ padding: "80px 40px", maxWidth: 1100, margin: "0 auto" }}>
        <h2 style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 48, textAlign: "center" }}>
          How <span className="gradient-text">Aequor</span> Works
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16 }}>
          {FLOW_STEPS.map((step, i) => (
            <div
              key={step.num}
              className="animate-fade-in"
              style={{
                background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-lg)", padding: "24px 20px",
                animationDelay: `${i * 100}ms`,
                position: "relative",
              }}
            >
              <span
                style={{
                  fontSize: 40, fontWeight: 800, color: "var(--bg-elevated)",
                  position: "absolute", top: 12, right: 16,
                  fontFamily: "var(--font-mono)",
                }}
              >
                {step.num}
              </span>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, position: "relative" }}>
                {step.title}
              </h3>
              <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5, position: "relative" }}>
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Agent Swarm ──────────────────────────────────────────────────────── */}
      <section style={{ padding: "80px 40px", maxWidth: 1100, margin: "0 auto" }}>
        <h2 style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 12, textAlign: "center" }}>
          The Agent <span className="gradient-text-cool">Swarm</span>
        </h2>
        <p style={{ fontSize: 15, color: "var(--text-muted)", textAlign: "center", marginBottom: 48 }}>
          Seven specialized agents work together to verify, audit, and pay.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          {AGENTS.map((agent, i) => (
            <div
              key={agent.name}
              className="animate-fade-in"
              style={{
                background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-lg)", padding: "24px",
                animationDelay: `${i * 80}ms`,
                transition: "all 0.2s ease",
                cursor: "default",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--border-accent)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border-subtle)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{
                  fontSize: 14, fontWeight: 700, color: "var(--accent-cyan)",
                  fontFamily: "var(--font-mono)",
                }}>
                  {agent.name}
                </span>
                <span className="badge badge-purple" style={{ fontSize: 10, padding: "2px 8px" }}>
                  {agent.role}
                </span>
              </div>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                {agent.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Scoring Model ────────────────────────────────────────────────────── */}
      <section style={{ padding: "80px 40px", maxWidth: 800, margin: "0 auto" }}>
        <h2 style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 48, textAlign: "center" }}>
          Scoring Model
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 48 }}>
          <div
            style={{
              background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-lg)", padding: "24px",
            }}
          >
            <div style={{ fontSize: 40, fontWeight: 800, marginBottom: 8 }} className="gradient-text">40%</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Objective Signals</div>
            <ul style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 2, listStyle: "none", paddingLeft: 0 }}>
              <li>- Commits and code volume</li>
              <li>- Tests passed</li>
              <li>- Files changed</li>
              <li>- Deadline adherence</li>
            </ul>
          </div>

          <div
            style={{
              background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-lg)", padding: "24px",
            }}
          >
            <div style={{ fontSize: 40, fontWeight: 800, marginBottom: 8 }} className="gradient-text-cool">60%</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>AI Reasoning</div>
            <ul style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 2, listStyle: "none", paddingLeft: 0 }}>
              <li>- Spec relevance</li>
              <li>- Code quality</li>
              <li>- Completeness</li>
              <li>- Maintainability</li>
            </ul>
          </div>
        </div>

        {/* Payout rules */}
        <div style={{ display: "flex", gap: 16 }}>
          <div style={{ flex: 1, padding: "16px 20px", borderRadius: "var(--radius-md)", background: "rgba(104,211,145,0.08)", border: "1px solid rgba(104,211,145,0.15)" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-green)", marginBottom: 4 }}>Score 80+</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Auto-release payment</div>
          </div>
          <div style={{ flex: 1, padding: "16px 20px", borderRadius: "var(--radius-md)", background: "rgba(246,173,85,0.08)", border: "1px solid rgba(246,173,85,0.15)" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-orange)", marginBottom: 4 }}>Score 60-79</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Manual review</div>
          </div>
          <div style={{ flex: 1, padding: "16px 20px", borderRadius: "var(--radius-md)", background: "rgba(252,129,129,0.08)", border: "1px solid rgba(252,129,129,0.15)" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-red)", marginBottom: 4 }}>Score &lt;60</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Hold payment</div>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer
        style={{
          padding: "40px",
          borderTop: "1px solid var(--border-subtle)",
          textAlign: "center",
          color: "var(--text-muted)",
          fontSize: 13,
        }}
      >
        Aequor -- AI-Verified Freelance Payments on Solana. Built for hackathon.
      </footer>
    </div>
  );
}
