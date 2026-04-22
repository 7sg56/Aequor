"""
notion.py — Notion polling adapter for Argus.

Polls a Notion database for recently edited pages
and emits a WorkSignal for each change detected.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

import httpx
from fastapi import Request

from apps.Argus.schema import EventType, Platform, WorkSignal

from .base import PlatformAdapter

logger = logging.getLogger("argus.adapter.notion")

NOTION_API_VERSION = "2022-06-28"


class NotionAdapter(PlatformAdapter):
    """Poll-based adapter for Notion database changes."""

    platform_name = Platform.NOTION

    def __init__(
        self,
        api_key: str,
        database_id: str,
        poll_interval: int = 120,
    ) -> None:
        self._api_key = api_key
        self._database_id = database_id
        self.poll_interval = poll_interval
        # Track last edit time per page
        self._seen_edits: dict[str, str] = {}

    # ------------------------------------------------------------------
    # Polling
    # ------------------------------------------------------------------
    async def poll(self) -> list[WorkSignal]:
        """Query the Notion database for recently updated pages."""
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Notion-Version": NOTION_API_VERSION,
            "Content-Type": "application/json",
        }
        signals: list[WorkSignal] = []

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    f"https://api.notion.com/v1/databases/{self._database_id}/query",
                    headers=headers,
                    json={
                        "sorts": [
                            {
                                "timestamp": "last_edited_time",
                                "direction": "descending",
                            }
                        ],
                        "page_size": 20,
                    },
                )
                resp.raise_for_status()
                results = resp.json().get("results", [])

                for page in results:
                    page_id = page.get("id", "")
                    last_edited = page.get("last_edited_time", "")
                    prev = self._seen_edits.get(page_id)

                    if prev is None:
                        self._seen_edits[page_id] = last_edited
                        continue

                    if last_edited != prev:
                        self._seen_edits[page_id] = last_edited

                        try:
                            event_ts = datetime.fromisoformat(
                                last_edited.replace("Z", "+00:00")
                            )
                        except (ValueError, TypeError):
                            event_ts = datetime.now(timezone.utc)

                        # Extract page title from properties
                        title_prop = page.get("properties", {}).get("Name", {})
                        title_parts = title_prop.get("title", [])
                        page_title = (
                            title_parts[0].get("plain_text", page_id)
                            if title_parts
                            else page_id
                        )

                        edited_by = (
                            page.get("last_edited_by", {})
                            .get("id", "unknown")
                        )

                        signal = WorkSignal(
                            platform=Platform.NOTION,
                            event_type=EventType.PAGE_EDIT,
                            project_id=f"notion:{self._database_id}",
                            contributor=edited_by,
                            title=f"Page edited: {page_title}",
                            metadata={
                                "page_id": page_id,
                                "url": page.get("url", ""),
                                "last_edited_time": last_edited,
                            },
                            event_timestamp=event_ts,
                        )
                        signal.compute_content_hash()
                        signals.append(signal)

        except httpx.HTTPError as exc:
            logger.error("Notion API error: %s", exc)

        if signals:
            logger.info("Notion poll → %d new signal(s)", len(signals))
        return signals

    # ------------------------------------------------------------------
    # Notion does not push webhooks — stub
    # ------------------------------------------------------------------
    async def handle_webhook(
        self,
        request: Request,
        payload: dict[str, Any],
    ) -> Optional[list[WorkSignal]]:
        logger.warning("Notion adapter received a webhook — this adapter is poll-only.")
        return []
