"""
config.py — Environment-driven configuration for Argus.

All secrets and tunables come from environment variables (or .env).
Pydantic Settings validates them at import time so failures are loud and early.
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings


class ArgusConfig(BaseSettings):
    """
    Argus agent configuration — every field maps 1:1 to an env var.
    """

    # ── Solana ────────────────────────────────────────────────────────
    solana_rpc_url: str = Field(
        default="https://api.devnet.solana.com",
        description="Solana JSON-RPC endpoint.",
    )
    swarm_bus_program_id: str = Field(
        default="G9ADiy7bb4bfqjEbihS8Mfaq1VSv7NvVRzyiQrFVjDSE",
        description="On-chain Swarm Bus program address.",
    )
    argus_keypair_path: str = Field(
        default="~/.config/solana/argus.json",
        description="Path to Argus's Solana keypair file.",
    )

    # ── Server ────────────────────────────────────────────────────────
    host: str = Field(default="0.0.0.0", description="Bind address.")
    port: int = Field(default=8100, description="HTTP port for webhooks.")

    # ── Adapters (feature flags) ──────────────────────────────────────
    adapter_github: bool = Field(default=True)
    adapter_figma: bool = Field(default=False)
    adapter_notion: bool = Field(default=False)
    adapter_webhook: bool = Field(default=True)

    # ── GitHub ────────────────────────────────────────────────────────
    github_webhook_secret: Optional[str] = Field(
        default=None,
        description="HMAC secret for verifying GitHub webhook payloads.",
    )

    # ── Figma ─────────────────────────────────────────────────────────
    figma_access_token: Optional[str] = Field(default=None)
    figma_team_id: Optional[str] = Field(default=None)
    figma_poll_interval: int = Field(
        default=120, description="Seconds between Figma polls."
    )

    # ── Notion ────────────────────────────────────────────────────────
    notion_api_key: Optional[str] = Field(default=None)
    notion_database_id: Optional[str] = Field(default=None)
    notion_poll_interval: int = Field(
        default=120, description="Seconds between Notion polls."
    )

    # ── Optional AI ───────────────────────────────────────────────────
    anthropic_api_key: Optional[str] = Field(default=None)

    # ── Logging ───────────────────────────────────────────────────────
    log_level: str = Field(default="INFO")

    model_config = {
        "env_file": str(Path(__file__).resolve().parent / ".env"),
        "env_file_encoding": "utf-8",
        "case_sensitive": False,
    }


def load_config() -> ArgusConfig:
    """Instantiate and return the validated config."""
    return ArgusConfig()
