"""
schema.py — Canonical data structures for Argus work signals.

Every adapter normalises raw platform events into this schema
before the signal is written to the Swarm Bus.

Schema version: 1
Versioning rule: bump SCHEMA_VERSION on any breaking field change.
"""

from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
SCHEMA_VERSION: int = 1


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------
class Platform(str, Enum):
    """Supported external work platforms."""
    GITHUB = "github"
    FIGMA = "figma"
    NOTION = "notion"
    WEBHOOK = "webhook"           # generic / manual


class EventType(str, Enum):
    """Canonical event types emitted by adapters."""
    COMMIT = "commit"
    PULL_REQUEST = "pull_request"
    ISSUE_CLOSED = "issue_closed"
    DESIGN_UPDATE = "design_update"
    PAGE_EDIT = "page_edit"
    TASK_COMPLETED = "task_completed"
    CUSTOM = "custom"


class SignalStatus(str, Enum):
    """Lifecycle status of a work signal."""
    PENDING = "pending"           # created, not yet written on-chain
    SUBMITTED = "submitted"       # tx sent
    CONFIRMED = "confirmed"       # tx confirmed on-chain
    FAILED = "failed"             # tx or validation failure


# ---------------------------------------------------------------------------
# Core data model
# ---------------------------------------------------------------------------
class WorkSignal(BaseModel):
    """
    The canonical work-signal that Argus emits.

    Every field here travels through the Swarm Bus and is consumed
    downstream by Agents 2-7.  Keep it minimal and stable.
    """

    # Identity
    signal_id: str = Field(
        default_factory=lambda: uuid.uuid4().hex,
        description="Unique identifier for this signal.",
    )
    schema_version: int = Field(
        default=SCHEMA_VERSION,
        description="Schema version — bump on breaking changes.",
    )

    # Source
    platform: Platform
    event_type: EventType
    project_id: str = Field(
        ..., description="External project / repo identifier."
    )
    contributor: str = Field(
        ..., description="Username or ID of the person who did the work."
    )

    # Payload
    title: str = Field(
        ..., description="Human-readable summary of the work event."
    )
    metadata: dict[str, Any] = Field(
        default_factory=dict,
        description="Adapter-specific extra data (commit SHA, PR URL, etc.).",
    )

    # Timestamps
    event_timestamp: datetime = Field(
        ..., description="When the work event occurred on the external platform."
    )
    detected_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="When Argus detected the event.",
    )

    # On-chain
    status: SignalStatus = Field(default=SignalStatus.PENDING)
    tx_signature: Optional[str] = Field(
        default=None,
        description="Solana transaction signature once submitted.",
    )

    # Integrity
    content_hash: Optional[str] = Field(
        default=None,
        description="SHA-256 of the deterministic JSON payload.",
    )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def compute_content_hash(self) -> str:
        """
        Deterministic hash of the signal's core payload.
        Used to detect duplicates and ensure integrity on-chain.
        """
        payload = {
            "signal_id": self.signal_id,
            "schema_version": self.schema_version,
            "platform": self.platform.value,
            "event_type": self.event_type.value,
            "project_id": self.project_id,
            "contributor": self.contributor,
            "title": self.title,
            "metadata": self.metadata,
            "event_timestamp": self.event_timestamp.isoformat(),
        }
        raw = json.dumps(payload, sort_keys=True, separators=(",", ":"))
        digest = hashlib.sha256(raw.encode()).hexdigest()
        self.content_hash = digest
        return digest

    def to_bus_payload(self) -> dict[str, Any]:
        """Serialise to the dict that gets written to the Swarm Bus."""
        if self.content_hash is None:
            self.compute_content_hash()
        return self.model_dump(mode="json")
