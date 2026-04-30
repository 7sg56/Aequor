"use client";

import { useState } from "react";
import Sidebar from "../components/shared/Sidebar";

export default function SettingsPage() {
  const [groqKey, setGroqKey] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [rpcUrl, setRpcUrl] = useState("https://api.devnet.solana.com");
  const [autoRelease, setAutoRelease] = useState(80);
  const [reviewThreshold, setReviewThreshold] = useState(60);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    borderRadius: "var(--radius-md)",
    background: "var(--bg-secondary)",
    border: "1px solid var(--border-default)",
    color: "var(--text-primary)",
    fontSize: 14,
    outline: "none",
    fontFamily: "var(--font-mono)",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 500,
    color: "var(--text-secondary)",
    marginBottom: 6,
    display: "block",
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />

      <main style={{ flex: 1, marginLeft: 220, padding: "32px 40px", maxWidth: 800 }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 4 }}>
            Settings
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
            API keys, thresholds, and blockchain configuration
          </p>
        </div>

        {/* API Keys */}
        <section
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-lg)",
            padding: 24,
            marginBottom: 24,
          }}
        >
          <h2
            style={{
              fontSize: 15,
              fontWeight: 600,
              marginBottom: 20,
              paddingBottom: 12,
              borderBottom: "1px solid var(--border-subtle)",
            }}
          >
            API Keys
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={labelStyle}>Groq API Key</label>
              <input
                type="password"
                value={groqKey}
                onChange={(e) => setGroqKey(e.target.value)}
                placeholder="gsk_..."
                style={inputStyle}
              />
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                Powers Themis, Dike, and Chronos audit streams. Get a key at console.groq.com.
              </p>
            </div>

            <div>
              <label style={labelStyle}>GitHub Token</label>
              <input
                type="password"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                placeholder="ghp_..."
                style={inputStyle}
              />
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                Used by Argus to fetch repo evidence. Works without a token for public repos (rate-limited).
              </p>
            </div>
          </div>
        </section>

        {/* Blockchain */}
        <section
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-lg)",
            padding: 24,
            marginBottom: 24,
          }}
        >
          <h2
            style={{
              fontSize: 15,
              fontWeight: 600,
              marginBottom: 20,
              paddingBottom: 12,
              borderBottom: "1px solid var(--border-subtle)",
            }}
          >
            Blockchain
          </h2>

          <div>
            <label style={labelStyle}>Solana RPC URL</label>
            <input
              type="url"
              value={rpcUrl}
              onChange={(e) => setRpcUrl(e.target.value)}
              style={inputStyle}
            />
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
              Default: devnet. Switch to mainnet-beta for production.
            </p>
          </div>
        </section>

        {/* Scoring Thresholds */}
        <section
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-lg)",
            padding: 24,
            marginBottom: 24,
          }}
        >
          <h2
            style={{
              fontSize: 15,
              fontWeight: 600,
              marginBottom: 20,
              paddingBottom: 12,
              borderBottom: "1px solid var(--border-subtle)",
            }}
          >
            Scoring Thresholds
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            <div>
              <label style={labelStyle}>
                Auto-Release Threshold: <span style={{ color: "var(--accent-green)", fontFamily: "var(--font-mono)" }}>{autoRelease}</span>
              </label>
              <input
                type="range"
                min={50}
                max={100}
                value={autoRelease}
                onChange={(e) => setAutoRelease(Number(e.target.value))}
                style={{ width: "100%", accentColor: "var(--accent-green)" }}
              />
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                Score at or above this triggers automatic payment via Plutus.
              </p>
            </div>

            <div>
              <label style={labelStyle}>
                Review Threshold: <span style={{ color: "var(--accent-orange)", fontFamily: "var(--font-mono)" }}>{reviewThreshold}</span>
              </label>
              <input
                type="range"
                min={30}
                max={80}
                value={reviewThreshold}
                onChange={(e) => setReviewThreshold(Number(e.target.value))}
                style={{ width: "100%", accentColor: "var(--accent-orange)" }}
              />
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                Score between this and auto-release requires manual review.
              </p>
            </div>
          </div>

          {/* Visual payout rules */}
          <div style={{ display: "flex", gap: 0, marginTop: 20, borderRadius: "var(--radius-md)", overflow: "hidden" }}>
            <div
              style={{
                flex: 100 - autoRelease,
                padding: "8px 12px",
                background: "rgba(104,211,145,0.15)",
                fontSize: 11,
                fontWeight: 600,
                color: "var(--accent-green)",
                textAlign: "center",
              }}
            >
              Auto ({autoRelease}-100)
            </div>
            <div
              style={{
                flex: autoRelease - reviewThreshold,
                padding: "8px 12px",
                background: "rgba(246,173,85,0.15)",
                fontSize: 11,
                fontWeight: 600,
                color: "var(--accent-orange)",
                textAlign: "center",
              }}
            >
              Review ({reviewThreshold}-{autoRelease - 1})
            </div>
            <div
              style={{
                flex: reviewThreshold,
                padding: "8px 12px",
                background: "rgba(252,129,129,0.15)",
                fontSize: 11,
                fontWeight: 600,
                color: "var(--accent-red)",
                textAlign: "center",
              }}
            >
              Hold (0-{reviewThreshold - 1})
            </div>
          </div>
        </section>

        {/* Save Button */}
        <button
          onClick={handleSave}
          style={{
            padding: "12px 32px",
            borderRadius: "var(--radius-xl)",
            background: saved ? "var(--gradient-success)" : "var(--gradient-primary)",
            border: "none",
            color: "#06070a",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          {saved ? "Saved" : "Save Configuration"}
        </button>
      </main>
    </div>
  );
}
