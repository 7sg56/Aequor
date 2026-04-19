"""
figma.py — Figma polling adapter for Argus.

Polls the Figma REST API for recent file version changes
and emits a WorkSignal for each new version detected.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

import httpx
from fastapi import Request

from apps.agent1.schema import EventType, Platform, WorkSignal

from .base import PlatformAdapter

logger = logging.getLogger("argus.adapter.figma")


class FigmaAdapter(PlatformAdapter):
    """Poll-based adapter that detects Figma file changes."""

    platform_name = Platform.FIGMA

    def __init__(
        self,
        access_token: str,
        team_id: str,
        poll_interval: int = 120,
    ) -> None:
        self._access_token = access_token
        self._team_id = team_id
        self.poll_interval = poll_interval
        # Track the last-seen version per file so we only emit new ones
        self._seen_versions: dict[str, str] = {}

    # ------------------------------------------------------------------
    # Polling
    # ------------------------------------------------------------------
    async def poll(self) -> list[WorkSignal]:
        """Fetch recent Figma project files and detect version bumps."""
        headers = {"X-Figma-Token": self._access_token}
        signals: list[WorkSignal] = []

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                # Get all projects for the team
                projects_resp = await client.get(
                    f"https://api.figma.com/v1/teams/{self._team_id}/projects",
                    headers=headers,
                )
                projects_resp.raise_for_status()
                projects = projects_resp.json().get("projects", [])

                for project in projects:
                    project_id = project.get("id", "")
                    # Get files in each project
                    files_resp = await client.get(
                        f"https://api.figma.com/v1/projects/{project_id}/files",
                        headers=headers,
                    )
                    files_resp.raise_for_status()
                    files = files_resp.json().get("files", [])

                    for file_info in files:
                        file_key = file_info.get("key", "")
                        last_modified = file_info.get("last_modified", "")
                        prev = self._seen_versions.get(file_key)

                        if prev is None:
                            # First time seeing this file — record but don't emit
                            self._seen_versions[file_key] = last_modified
                            continue

                        if last_modified != prev:
                            # Version changed — emit signal
                            self._seen_versions[file_key] = last_modified

                            try:
                                event_ts = datetime.fromisoformat(
                                    last_modified.replace("Z", "+00:00")
                                )
                            except (ValueError, TypeError):
                                event_ts = datetime.now(timezone.utc)

                            signal = WorkSignal(
                                platform=Platform.FIGMA,
                                event_type=EventType.DESIGN_UPDATE,
                                project_id=f"figma:{self._team_id}/{project_id}",
                                contributor=f"figma-team-{self._team_id}",
                                title=f"Design update: {file_info.get('name', file_key)}",
                                metadata={
                                    "file_key": file_key,
                                    "file_name": file_info.get("name", ""),
                                    "thumbnail_url": file_info.get("thumbnail_url", ""),
                                    "last_modified": last_modified,
                                },
                                event_timestamp=event_ts,
                            )
                            signal.compute_content_hash()
                            signals.append(signal)

        except httpx.HTTPError as exc:
            logger.error("Figma API error: %s", exc)

        if signals:
            logger.info("Figma poll → %d new signal(s)", len(signals))
        return signals

    # ------------------------------------------------------------------
    # Figma does not push webhooks (free tier) — stub to satisfy ABC
    # ------------------------------------------------------------------
    async def handle_webhook(
        self,
        request: Request,
        payload: dict[str, Any],
    ) -> Optional[list[WorkSignal]]:
        logger.warning("Figma adapter received a webhook — this adapter is poll-only.")
        return []
