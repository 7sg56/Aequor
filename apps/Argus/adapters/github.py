"""
github.py — GitHub webhook adapter for Argus.

Handles push (commit), pull_request, and issues events.
Verifies HMAC-SHA256 signatures when a secret is configured.
"""

from __future__ import annotations

import hashlib
import hmac
import logging
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import Request

from apps.agent1.schema import EventType, Platform, WorkSignal

from .base import PlatformAdapter

logger = logging.getLogger("argus.adapter.github")


class GitHubAdapter(PlatformAdapter):
    """Normalises GitHub webhook events into WorkSignals."""

    platform_name = Platform.GITHUB

    def __init__(self, webhook_secret: Optional[str] = None) -> None:
        # Treat empty string the same as None (no secret configured)
        self._webhook_secret = webhook_secret or None

    # ------------------------------------------------------------------
    # Signature verification
    # ------------------------------------------------------------------
    async def verify_signature(self, request: Request) -> bool:
        if self._webhook_secret is None:
            return True

        signature_header = request.headers.get("x-hub-signature-256", "")
        if not signature_header.startswith("sha256="):
            logger.warning("Missing or malformed GitHub signature header")
            return False

        body = await request.body()
        expected = hmac.new(
            self._webhook_secret.encode(),
            body,
            hashlib.sha256,
        ).hexdigest()

        return hmac.compare_digest(f"sha256={expected}", signature_header)

    # ------------------------------------------------------------------
    # Webhook handler
    # ------------------------------------------------------------------
    async def handle_webhook(
        self,
        request: Request,
        payload: dict[str, Any],
    ) -> Optional[list[WorkSignal]]:
        event = request.headers.get("x-github-event", "unknown")
        logger.info("GitHub event received: %s", event)

        if event == "ping":
            logger.info("GitHub ping — ignoring")
            return None

        handler = {
            "push": self._handle_push,
            "pull_request": self._handle_pull_request,
            "issues": self._handle_issues,
        }.get(event)

        if handler is None:
            logger.info("Unhandled GitHub event type: %s — skipping", event)
            return []

        return handler(payload)

    # ------------------------------------------------------------------
    # Event-specific normalisers
    # ------------------------------------------------------------------
    def _handle_push(self, payload: dict[str, Any]) -> list[WorkSignal]:
        """One WorkSignal per commit in the push."""
        repo = payload.get("repository", {}).get("full_name", "unknown/repo")
        signals: list[WorkSignal] = []

        for commit in payload.get("commits", []):
            ts_str = commit.get("timestamp", "")
            try:
                event_ts = datetime.fromisoformat(ts_str)
            except (ValueError, TypeError):
                event_ts = datetime.now(timezone.utc)

            signal = WorkSignal(
                platform=Platform.GITHUB,
                event_type=EventType.COMMIT,
                project_id=repo,
                contributor=commit.get("author", {}).get("username", "unknown"),
                title=commit.get("message", "")[:120],
                metadata={
                    "sha": commit.get("id", ""),
                    "url": commit.get("url", ""),
                    "branch": payload.get("ref", ""),
                    "files_added": len(commit.get("added", [])),
                    "files_modified": len(commit.get("modified", [])),
                    "files_removed": len(commit.get("removed", [])),
                },
                event_timestamp=event_ts,
            )
            signal.compute_content_hash()
            signals.append(signal)

        logger.info("GitHub push → %d signal(s) from %s", len(signals), repo)
        return signals

    def _handle_pull_request(self, payload: dict[str, Any]) -> list[WorkSignal]:
        """One signal per PR action (opened, closed, merged)."""
        pr = payload.get("pull_request", {})
        action = payload.get("action", "unknown")
        repo = payload.get("repository", {}).get("full_name", "unknown/repo")

        ts_str = pr.get("updated_at") or pr.get("created_at", "")
        try:
            event_ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            event_ts = datetime.now(timezone.utc)

        signal = WorkSignal(
            platform=Platform.GITHUB,
            event_type=EventType.PULL_REQUEST,
            project_id=repo,
            contributor=pr.get("user", {}).get("login", "unknown"),
            title=f"[{action}] {pr.get('title', '')}",
            metadata={
                "pr_number": pr.get("number"),
                "action": action,
                "merged": pr.get("merged", False),
                "url": pr.get("html_url", ""),
                "additions": pr.get("additions", 0),
                "deletions": pr.get("deletions", 0),
                "changed_files": pr.get("changed_files", 0),
            },
            event_timestamp=event_ts,
        )
        signal.compute_content_hash()

        logger.info("GitHub PR %s → signal from %s", action, repo)
        return [signal]

    def _handle_issues(self, payload: dict[str, Any]) -> list[WorkSignal]:
        """Signal only for closed issues."""
        action = payload.get("action", "")
        if action != "closed":
            return []

        issue = payload.get("issue", {})
        repo = payload.get("repository", {}).get("full_name", "unknown/repo")

        ts_str = issue.get("closed_at", "")
        try:
            event_ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            event_ts = datetime.now(timezone.utc)

        signal = WorkSignal(
            platform=Platform.GITHUB,
            event_type=EventType.ISSUE_CLOSED,
            project_id=repo,
            contributor=issue.get("user", {}).get("login", "unknown"),
            title=f"Issue closed: {issue.get('title', '')}",
            metadata={
                "issue_number": issue.get("number"),
                "url": issue.get("html_url", ""),
                "labels": [l.get("name") for l in issue.get("labels", [])],
            },
            event_timestamp=event_ts,
        )
        signal.compute_content_hash()

        logger.info("GitHub issue closed → signal from %s", repo)
        return [signal]
