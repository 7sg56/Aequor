"""
core.py — Argus agent main loop and HTTP server.

Starts FastAPI, mounts webhook routes for each enabled adapter,
launches polling loops for pull-based adapters, and dispatches
every WorkSignal to the Solana writer.

Run with:
    python -m apps.agent1.core
"""

from __future__ import annotations

import asyncio
import logging
import sys
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any

import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from apps.agent1.adapters.base import PlatformAdapter
from apps.agent1.adapters.figma import FigmaAdapter
from apps.agent1.adapters.github import GitHubAdapter
from apps.agent1.adapters.notion import NotionAdapter
from apps.agent1.adapters.webhook import GenericWebhookAdapter
from apps.agent1.config import ArgusConfig, load_config
from apps.agent1.schema import SignalStatus, WorkSignal
from apps.agent1.solana_writer import SolanaWriter

# ---------------------------------------------------------------------------
# Logging setup
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  [%(name)s]  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("argus")


# ---------------------------------------------------------------------------
# Agent
# ---------------------------------------------------------------------------
class ArgusAgent:
    """
    Orchestrates adapters, the HTTP server, and the Solana writer.

    Lifecycle:
      1. build_agent() — reads config, instantiates adapters + writer.
      2. start()       — runs the FastAPI server + polling loops.
    """

    def __init__(
        self,
        config: ArgusConfig,
        adapters: list[PlatformAdapter],
        writer: SolanaWriter,
    ) -> None:
        self.config = config
        self.adapters = adapters
        self.writer = writer
        # In-memory signal ledger (most recent 200)
        self.signal_log: list[dict[str, Any]] = []
        self._polling_tasks: list[asyncio.Task[None]] = []

    # ------------------------------------------------------------------
    # Signal dispatch
    # ------------------------------------------------------------------
    async def dispatch_signals(self, signals: list[WorkSignal]) -> None:
        """Send each signal to the Solana writer and log results."""
        for signal in signals:
            logger.info(
                "⚡ Signal  id=%s  platform=%s  type=%s  project=%s",
                signal.signal_id[:8],
                signal.platform.value,
                signal.event_type.value,
                signal.project_id,
            )

            # Write on-chain
            tx_sig = await self.writer.write_signal(signal)
            if tx_sig:
                signal.status = SignalStatus.SUBMITTED
                signal.tx_signature = tx_sig
                # Fire-and-forget confirmation check
                asyncio.create_task(self._confirm_and_update(signal, tx_sig))
            else:
                signal.status = SignalStatus.FAILED

            # Append to in-memory ledger
            entry = signal.to_bus_payload()
            self.signal_log.append(entry)
            if len(self.signal_log) > 200:
                self.signal_log = self.signal_log[-200:]

    async def _confirm_and_update(self, signal: WorkSignal, tx_sig: str) -> None:
        """Background task to confirm a transaction."""
        ok = await self.writer.confirm_transaction(tx_sig)
        if ok:
            signal.status = SignalStatus.CONFIRMED
            logger.info("✓ Confirmed signal %s", signal.signal_id[:8])
        else:
            signal.status = SignalStatus.FAILED
            logger.warning("✗ Confirmation failed for signal %s", signal.signal_id[:8])

    # ------------------------------------------------------------------
    # Polling loops
    # ------------------------------------------------------------------
    async def _run_poller(self, adapter: PlatformAdapter, interval: int) -> None:
        """Periodically call adapter.poll() and dispatch results."""
        logger.info(
            "Starting poller for %s (every %ds)",
            adapter.platform_name.value,
            interval,
        )
        while True:
            try:
                signals = await adapter.poll()
                if signals:
                    await self.dispatch_signals(signals)
            except Exception as exc:
                logger.error(
                    "Poller error (%s): %s",
                    adapter.platform_name.value,
                    exc,
                )
            await asyncio.sleep(interval)

    def start_pollers(self) -> None:
        """Launch polling tasks for pull-based adapters."""
        for adapter in self.adapters:
            interval: int | None = getattr(adapter, "poll_interval", None)
            if interval is not None:
                task = asyncio.create_task(self._run_poller(adapter, interval))
                self._polling_tasks.append(task)

    def stop_pollers(self) -> None:
        """Cancel all polling tasks."""
        for task in self._polling_tasks:
            task.cancel()
        self._polling_tasks.clear()


# ---------------------------------------------------------------------------
# FastAPI app factory
# ---------------------------------------------------------------------------
def build_agent(config: ArgusConfig | None = None) -> tuple[ArgusAgent, FastAPI]:
    """Wire everything together and return (agent, app)."""
    if config is None:
        config = load_config()

    logger.setLevel(config.log_level.upper())

    # ── Solana writer ─────────────────────────────────────────────────
    writer = SolanaWriter(
        rpc_url=config.solana_rpc_url,
        program_id=config.swarm_bus_program_id,
        keypair_path=config.argus_keypair_path,
    )

    # ── Adapters ──────────────────────────────────────────────────────
    adapters: list[PlatformAdapter] = []

    if config.adapter_github:
        adapters.append(GitHubAdapter(webhook_secret=config.github_webhook_secret))

    if config.adapter_figma and config.figma_access_token and config.figma_team_id:
        adapters.append(
            FigmaAdapter(
                access_token=config.figma_access_token,
                team_id=config.figma_team_id,
                poll_interval=config.figma_poll_interval,
            )
        )

    if config.adapter_notion and config.notion_api_key and config.notion_database_id:
        adapters.append(
            NotionAdapter(
                api_key=config.notion_api_key,
                database_id=config.notion_database_id,
                poll_interval=config.notion_poll_interval,
            )
        )

    if config.adapter_webhook:
        adapters.append(GenericWebhookAdapter())

    logger.info(
        "Adapters loaded: %s",
        ", ".join(a.platform_name.value for a in adapters) or "(none)",
    )

    # ── Agent ─────────────────────────────────────────────────────────
    agent = ArgusAgent(config=config, adapters=adapters, writer=writer)

    # ── FastAPI ───────────────────────────────────────────────────────
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        agent.start_pollers()
        bal = await writer.get_balance()
        logger.info("Signer balance: %.4f SOL", bal)
        logger.info(
            "🔭 Argus is watching — %d adapter(s) active on :%d",
            len(adapters),
            config.port,
        )
        yield
        agent.stop_pollers()
        logger.info("Argus shutting down.")

    app = FastAPI(
        title="Argus — Work Verifier Agent",
        description="Aequor Swarm · Agent 1",
        version="0.1.0",
        lifespan=lifespan,
    )

    # ── Health endpoint ───────────────────────────────────────────────
    @app.get("/health")
    async def health():
        return {
            "agent": "argus",
            "status": "ok",
            "adapters": [a.platform_name.value for a in adapters],
            "signals_logged": len(agent.signal_log),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    # ── Signal log endpoint ───────────────────────────────────────────
    @app.get("/signals")
    async def list_signals():
        return {"count": len(agent.signal_log), "signals": agent.signal_log[-50:]}

    # ── Webhook routes (one per push-based adapter) ───────────────────
    for adapter in adapters:

        def _make_handler(adpt: PlatformAdapter):
            async def webhook_handler(request: Request):
                # Verify signature
                if not await adpt.verify_signature(request):
                    return JSONResponse(
                        {"error": "Invalid signature"}, status_code=401
                    )
                try:
                    payload = await request.json()
                except Exception:
                    return JSONResponse(
                        {"error": "Invalid JSON body"}, status_code=400
                    )

                signals = await adpt.handle_webhook(request, payload)
                if signals is None:
                    return {"status": "ignored"}

                if signals:
                    await agent.dispatch_signals(signals)

                return {
                    "status": "accepted",
                    "signals_emitted": len(signals),
                }

            return webhook_handler

        app.add_api_route(
            adapter.webhook_route,
            _make_handler(adapter),
            methods=["POST"],
            name=f"webhook_{adapter.platform_name.value}",
        )
        logger.info("Mounted route: POST %s", adapter.webhook_route)

    return agent, app


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------
def main() -> None:
    """CLI entrypoint — python -m apps.agent1.core"""
    config = load_config()
    _agent, app = build_agent(config)

    uvicorn.run(
        app,
        host=config.host,
        port=config.port,
        log_level=config.log_level.lower(),
    )


if __name__ == "__main__":
    main()
