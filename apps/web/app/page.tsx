const agents = [
  { id: "01", name: "Argus", role: "Work Verifier", tech: "Python + FastAPI" },
  { id: "02", name: "Themis", role: "Completeness Auditor", tech: "Claude Haiku" },
  { id: "03", name: "Dike", role: "Quality Auditor", tech: "Claude Haiku" },
  { id: "04", name: "Chronos", role: "Timeliness Auditor", tech: "Claude Haiku" },
  { id: "05", name: "Kratos", role: "Consensus Orchestrator", tech: "Weighted avg" },
  { id: "06", name: "Nemesis", role: "Dispute Arbiter", tech: "On-chain LLM" },
  { id: "07", name: "Plutus", role: "Payment Streamer", tech: "Stream CPI" },
];

const onChain = [
  ["Escrow Program", "Rust + Anchor, milestone vault PDA, dispute logic"],
  ["Swarm Bus", "Agent message router, PDA per agent keypair"],
  ["Stream Payment", "Per-second USDC release via CPI"],
  ["Reputation", "Portable worker + client PDAs"],
];

const offChain = [
  ["Agent Runtime", "Python 3.12 + asyncio, one process per agent"],
  ["Solana Client", "solders + anchorpy"],
  ["LLM Backbone", "Claude Haiku via Anthropic API"],
  ["Frontend", "Next.js + @solana/wallet-adapter"],
];

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-bg text-text">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 md:px-16 py-5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-accent flex items-center justify-center">
            <span className="text-xs font-bold text-black">A</span>
          </div>
          <span className="text-sm font-semibold tracking-tight">Aequor</span>
        </div>
        <span className="text-[11px] font-mono px-2.5 py-1 rounded-full border border-border text-text-2">
          devnet
        </span>
      </nav>

      {/* Hero */}
      <section className="fade-up px-6 md:px-16 pt-28 pb-24 max-w-[720px]">
        <p className="text-[11px] font-mono text-accent uppercase tracking-widest mb-6">
          Solana Swarm Hackathon &middot; PAY Track
        </p>
        <h1 className="text-3xl md:text-5xl font-bold leading-[1.15] tracking-tight">
          The gig economy where AI agents replace the middleman.
        </h1>
        <p className="mt-5 text-base md:text-lg text-text-2 leading-relaxed max-w-[560px]">
          Workers get paid per second, in real time, verified on Solana. Zero
          platform fees. No human intermediary.
        </p>
      </section>

      {/* Stats */}
      <section className="px-6 md:px-16 pb-20">
        <div className="flex flex-col sm:flex-row gap-8 sm:gap-16">
          {[
            ["1.1B", "Gig workers globally"],
            ["$450B", "Annual platform fees"],
            ["30 days", "Average invoice wait"],
          ].map(([value, label]) => (
            <div key={label}>
              <p className="text-2xl font-bold font-mono text-accent">
                {value}
              </p>
              <p className="text-xs text-text-2 mt-1">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="border-t border-border" />

      {/* Mission */}
      <section className="px-6 md:px-16 py-20 max-w-[720px]">
        <p className="text-[11px] font-mono text-text-3 uppercase tracking-widest mb-4">
          Mission
        </p>
        <p className="text-base text-text-2 leading-relaxed">
          Aequor exists to rebuild the trust layer of the global gig economy
          from scratch -- not by building a better platform, but by eliminating
          the need for a platform entirely. Using a swarm of specialized AI
          agents running on Solana, Aequor automates work verification, quality
          scoring, payment release, and dispute resolution.
        </p>
      </section>

      <div className="border-t border-border" />

      {/* The Problem */}
      <section className="px-6 md:px-16 py-20">
        <p className="text-[11px] font-mono text-text-3 uppercase tracking-widest mb-4">
          The Problem
        </p>
        <h2 className="text-xl md:text-2xl font-bold mb-10">
          Three broken guarantees
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            [
              "Fair Pay",
              "Workers wait 15-45 days for invoices. Platforms take 15-30%. Cross-border payments require banks many workers lack.",
            ],
            [
              "Neutral Disputes",
              "Platforms favor high-spending clients. No evidence-based arbitration. Support agents carry financial bias.",
            ],
            [
              "Portable Reputation",
              "5 years of 5-star reviews on one platform are worth nothing on another. Reputation is hostage.",
            ],
          ].map(([title, desc]) => (
            <div
              key={title}
              className="p-5 rounded-xl bg-surface border border-border"
            >
              <h3 className="text-sm font-semibold mb-2">{title}</h3>
              <p className="text-xs text-text-2 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="border-t border-border" />

      {/* Who It's Built For */}
      <section className="px-6 md:px-16 py-20">
        <p className="text-[11px] font-mono text-text-3 uppercase tracking-widest mb-4">
          Built For
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-xl bg-surface border border-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-md bg-accent flex items-center justify-center text-black text-xs font-bold">
                W
              </div>
              <div>
                <p className="text-sm font-semibold">The Worker</p>
                <p className="text-[11px] text-text-3">
                  Developer &middot; Designer &middot; Writer
                </p>
              </div>
            </div>
            <p className="text-xs text-text-2 leading-relaxed">
              Freelancers in emerging markets who deliver world-class work but
              are trapped by slow payment rails, high fees, and platforms that
              don&apos;t protect them. They want instant pay, zero cut, and a
              reputation they own.
            </p>
            <div className="flex flex-wrap gap-1.5 mt-4">
              {["Paid per second", "Owns reputation PDA", "No bank needed"].map(
                (t) => (
                  <span
                    key={t}
                    className="text-[10px] font-mono px-2 py-1 rounded-md border border-border text-text-2"
                  >
                    {t}
                  </span>
                )
              )}
            </div>
          </div>
          <div className="p-6 rounded-xl bg-surface border border-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-md bg-zinc-700 flex items-center justify-center text-white text-xs font-bold">
                C
              </div>
              <div>
                <p className="text-sm font-semibold">The Client</p>
                <p className="text-[11px] text-text-3">
                  Startup &middot; Agency &middot; Enterprise
                </p>
              </div>
            </div>
            <p className="text-xs text-text-2 leading-relaxed">
              Founders and product teams hiring globally who want accountability
              without manual invoice review. Deposit into escrow and let the
              agents handle verification -- pay only for verified work.
            </p>
            <div className="flex flex-wrap gap-1.5 mt-4">
              {[
                "Pays only for delivery",
                "Auto-scored milestones",
                "On-chain proof",
              ].map((t) => (
                <span
                  key={t}
                  className="text-[10px] font-mono px-2 py-1 rounded-md border border-border text-text-2"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="border-t border-border" />

      {/* 7-Agent Swarm */}
      <section id="how-it-works" className="px-6 md:px-16 py-20">
        <p className="text-[11px] font-mono text-text-3 uppercase tracking-widest mb-4">
          Architecture
        </p>
        <h2 className="text-xl md:text-2xl font-bold mb-3">
          The 7-agent swarm
        </h2>
        <p className="text-sm text-text-2 mb-10 max-w-[560px]">
          Seven specialized AI agents, each with its own Solana keypair and PDA.
          They communicate exclusively through the Swarm Bus program.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {agents.map((a) => (
            <div
              key={a.id}
              className="p-4 rounded-xl bg-surface border border-border flex flex-col"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono text-text-3">
                  {a.id}
                </span>
                <span className="text-[10px] font-mono text-text-3">
                  {a.tech}
                </span>
              </div>
              <p className="text-sm font-semibold">{a.name}</p>
              <p className="text-[11px] text-accent font-mono mt-0.5">
                {a.role}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="border-t border-border" />

      {/* Tech Stack */}
      <section id="tech-stack" className="px-6 md:px-16 py-20">
        <p className="text-[11px] font-mono text-text-3 uppercase tracking-widest mb-4">
          Stack
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div>
            <h3 className="text-xs font-mono text-text-2 uppercase tracking-widest mb-4">
              On-Chain
            </h3>
            <div className="space-y-2">
              {onChain.map(([name, detail]) => (
                <div
                  key={name}
                  className="flex flex-col p-3 rounded-lg bg-surface border border-border"
                >
                  <span className="text-sm font-medium">{name}</span>
                  <span className="text-[11px] text-text-3 font-mono mt-0.5">
                    {detail}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-xs font-mono text-text-2 uppercase tracking-widest mb-4">
              Off-Chain
            </h3>
            <div className="space-y-2">
              {offChain.map(([name, detail]) => (
                <div
                  key={name}
                  className="flex flex-col p-3 rounded-lg bg-surface border border-border"
                >
                  <span className="text-sm font-medium">{name}</span>
                  <span className="text-[11px] text-text-3 font-mono mt-0.5">
                    {detail}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[11px] font-mono text-text-3">
          <span>
            Network: <span className="text-text-2">Solana Devnet</span>
          </span>
          <span>
            Token: <span className="text-text-2">USDC (SPL)</span>
          </span>
          <span>
            RPC: <span className="text-text-2">Helius</span>
          </span>
          <span>
            Anchor: <span className="text-text-2">0.32.1</span>
          </span>
        </div>
      </section>

      <div className="border-t border-border" />

      {/* Pitch */}
      <section className="px-6 md:px-16 py-20 max-w-[720px]">
        <p className="text-base md:text-lg text-text-2 leading-relaxed">
          A swarm of 7 AI agents on Solana that replaces the gig economy&apos;s
          middleman -- verifying work, scoring milestones, streaming payment per
          second, and arbitrating disputes on-chain, with{" "}
          <span className="text-text font-medium">zero platform fees</span> and{" "}
          <span className="text-text font-medium">no human intermediary</span>.
        </p>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-border px-6 md:px-16 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-accent flex items-center justify-center">
            <span className="text-[9px] font-bold text-black">A</span>
          </div>
          <span className="text-xs text-text-2">
            Aequor &middot; PayStream Guild
          </span>
        </div>
        <span className="text-[11px] font-mono text-text-3">
          Solana Swarm Hackathon 2025
        </span>
      </footer>
    </div>
  );
}
