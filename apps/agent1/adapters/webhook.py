"""
webhook.py — Generic / manual webhook adapter for Argus.

Accepts arbitrary JSON payloads from any external source and
maps them directly to a WorkSignal.  Useful for demos, manual
testing, or integrating platforms that don't have a dedicated adapter.

Expected payload schema:
{
    "project_id": "my-project",
    "contributor": "alice",
    "title": "Completed milestone 3",
    "event_type": "task_completed",   # optional — defaults to "custom"
    "metadata": { ... }               # optional
}
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import Request

from apps.agent1.schema import EventType, Platform, WorkSignal

from .base import PlatformAdapter

logger = logging.getLogger("argus.adapter.webhook")


class GenericWebhookAdapter(PlatformAdapter):
    """Accept any JSON payload and normalise it into a WorkSignal."""

    platform_name = Platform.WEBHOOK

    async def handle_webhook(
        self,
        request: Request,
        payload: dict[str, Any],
    ) -> Optional[list[WorkSignal]]:
        project_id = payload.get("project_id")
        contributor = payload.get("contributor")
        title = payload.get("title")

        if not all([project_id, contributor, title]):
            logger.warning(
                "Generic webhook missing required fields "
                "(project_id, contributor, title) — ignoring."
            )
            return []

        # Map the event_type string to an EventType enum (fallback: CUSTOM)
        raw_event_type = payload.get("event_type", "custom")
        try:
            event_type = EventType(raw_event_type)
        except ValueError:
            event_type = EventType.CUSTOM

        signal = WorkSignal(
            platform=Platform.WEBHOOK,
            event_type=event_type,
            project_id=project_id,
            contributor=contributor,
            title=title[:120],
            metadata=payload.get("metadata", {}),
            event_timestamp=datetime.now(timezone.utc),
        )
        signal.compute_content_hash()

        logger.info("Generic webhook → signal for project %s", project_id)
        return [signal]
