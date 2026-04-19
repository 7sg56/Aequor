"""
test_agent1.py — Unit tests for Argus (Agent 1).

Covers:
  - WorkSignal schema creation and hashing
  - GitHub adapter normalisation (push, PR, issues)
  - Generic webhook adapter
  - Config validation
  - Agent build + health endpoint
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from apps.agent1.schema import (
    SCHEMA_VERSION,
    EventType,
    Platform,
    SignalStatus,
    WorkSignal,
)
from apps.agent1.adapters.github import GitHubAdapter
from apps.agent1.adapters.webhook import GenericWebhookAdapter
from apps.agent1.config import ArgusConfig
from apps.agent1.core import build_agent

FIXTURES = Path(__file__).resolve().parent / "fixtures"


# ═══════════════════════════════════════════════════════════════════════
# Schema tests
# ═══════════════════════════════════════════════════════════════════════

class TestWorkSignal:
    """Tests for the WorkSignal data model."""

    def _make_signal(self, **overrides) -> WorkSignal:
        defaults = dict(
            platform=Platform.GITHUB,
            event_type=EventType.COMMIT,
            project_id="aequor-org/demo",
            contributor="alice",
            title="test commit",
            event_timestamp=datetime(2026, 4, 19, 12, 0, tzinfo=timezone.utc),
        )
        defaults.update(overrides)
        return WorkSignal(**defaults)

    def test_signal_creation(self):
        sig = self._make_signal()
        assert sig.platform == Platform.GITHUB
        assert sig.event_type == EventType.COMMIT
        assert sig.status == SignalStatus.PENDING
        assert sig.schema_version == SCHEMA_VERSION

    def test_signal_id_unique(self):
        s1 = self._make_signal()
        s2 = self._make_signal()
        assert s1.signal_id != s2.signal_id

    def test_content_hash_deterministic(self):
        s1 = self._make_signal(signal_id="fixed-id")
        s2 = self._make_signal(signal_id="fixed-id")
        assert s1.compute_content_hash() == s2.compute_content_hash()

    def test_content_hash_changes_with_data(self):
        s1 = self._make_signal(signal_id="fixed-id", title="title A")
        s2 = self._make_signal(signal_id="fixed-id", title="title B")
        assert s1.compute_content_hash() != s2.compute_content_hash()

    def test_to_bus_payload(self):
        sig = self._make_signal()
        payload = sig.to_bus_payload()
        assert isinstance(payload, dict)
        assert payload["platform"] == "github"
        assert payload["content_hash"] is not None

    def test_platform_enum(self):
        for p in Platform:
            assert isinstance(p.value, str)

    def test_event_type_enum(self):
        for e in EventType:
            assert isinstance(e.value, str)


# ═══════════════════════════════════════════════════════════════════════
# GitHub adapter tests
# ═══════════════════════════════════════════════════════════════════════

class TestGitHubAdapter:
    """Tests for the GitHub webhook adapter."""

    @pytest.fixture
    def adapter(self):
        return GitHubAdapter(webhook_secret=None)

    @pytest.fixture
    def push_payload(self) -> dict:
        return json.loads((FIXTURES / "sample_github_event.json").read_text())

    @pytest.mark.asyncio
    async def test_push_event(self, adapter, push_payload):
        request = MagicMock()
        request.headers = {"x-github-event": "push"}

        signals = await adapter.handle_webhook(request, push_payload)

        assert signals is not None
        assert len(signals) == 2

        s1 = signals[0]
        assert s1.platform == Platform.GITHUB
        assert s1.event_type == EventType.COMMIT
        assert s1.project_id == "aequor-org/demo-repo"
        assert s1.contributor == "alice-dev"
        assert "milestone 3" in s1.title
        assert s1.metadata["sha"] == "abc123def456789"
        assert s1.content_hash is not None

        s2 = signals[1]
        assert s2.contributor == "bob-builder"
        assert s2.metadata["files_modified"] == 2

    @pytest.mark.asyncio
    async def test_ping_event(self, adapter):
        request = MagicMock()
        request.headers = {"x-github-event": "ping"}

        result = await adapter.handle_webhook(request, {"zen": "test"})
        assert result is None

    @pytest.mark.asyncio
    async def test_pr_event(self, adapter):
        request = MagicMock()
        request.headers = {"x-github-event": "pull_request"}

        payload = {
            "action": "opened",
            "pull_request": {
                "title": "Add new feature",
                "user": {"login": "charlie"},
                "number": 42,
                "html_url": "https://github.com/org/repo/pull/42",
                "merged": False,
                "created_at": "2026-04-19T10:00:00Z",
                "updated_at": "2026-04-19T10:00:00Z",
                "additions": 100,
                "deletions": 20,
                "changed_files": 5,
            },
            "repository": {"full_name": "aequor-org/demo-repo"},
        }

        signals = await adapter.handle_webhook(request, payload)
        assert len(signals) == 1
        assert signals[0].event_type == EventType.PULL_REQUEST
        assert signals[0].contributor == "charlie"
        assert signals[0].metadata["pr_number"] == 42

    @pytest.mark.asyncio
    async def test_issue_closed_event(self, adapter):
        request = MagicMock()
        request.headers = {"x-github-event": "issues"}

        payload = {
            "action": "closed",
            "issue": {
                "title": "Fix login bug",
                "number": 7,
                "user": {"login": "dave"},
                "html_url": "https://github.com/org/repo/issues/7",
                "closed_at": "2026-04-19T15:00:00Z",
                "labels": [{"name": "bug"}, {"name": "priority-high"}],
            },
            "repository": {"full_name": "aequor-org/demo-repo"},
        }

        signals = await adapter.handle_webhook(request, payload)
        assert len(signals) == 1
        assert signals[0].event_type == EventType.ISSUE_CLOSED
        assert "Fix login bug" in signals[0].title

    @pytest.mark.asyncio
    async def test_issue_opened_ignored(self, adapter):
        request = MagicMock()
        request.headers = {"x-github-event": "issues"}
        payload = {"action": "opened", "issue": {}, "repository": {"full_name": "a/b"}}

        signals = await adapter.handle_webhook(request, payload)
        assert signals == []

    @pytest.mark.asyncio
    async def test_unknown_event_ignored(self, adapter):
        request = MagicMock()
        request.headers = {"x-github-event": "deployment"}

        signals = await adapter.handle_webhook(request, {})
        assert signals == []


# ═══════════════════════════════════════════════════════════════════════
# Generic webhook adapter tests
# ═══════════════════════════════════════════════════════════════════════

class TestGenericWebhookAdapter:
    """Tests for the generic / manual webhook adapter."""

    @pytest.fixture
    def adapter(self):
        return GenericWebhookAdapter()

    @pytest.mark.asyncio
    async def test_valid_payload(self, adapter):
        request = MagicMock()
        payload = {
            "project_id": "test-project",
            "contributor": "alice",
            "title": "Completed milestone 3",
            "event_type": "task_completed",
            "metadata": {"milestone": 3},
        }

        signals = await adapter.handle_webhook(request, payload)
        assert len(signals) == 1
        assert signals[0].platform == Platform.WEBHOOK
        assert signals[0].event_type == EventType.TASK_COMPLETED
        assert signals[0].project_id == "test-project"
        assert signals[0].metadata["milestone"] == 3

    @pytest.mark.asyncio
    async def test_missing_required_fields(self, adapter):
        request = MagicMock()
        payload = {"project_id": "test-project"}  # missing contributor, title

        signals = await adapter.handle_webhook(request, payload)
        assert signals == []

    @pytest.mark.asyncio
    async def test_unknown_event_type_defaults_to_custom(self, adapter):
        request = MagicMock()
        payload = {
            "project_id": "proj",
            "contributor": "bob",
            "title": "Something happened",
            "event_type": "something_unknown",
        }

        signals = await adapter.handle_webhook(request, payload)
        assert len(signals) == 1
        assert signals[0].event_type == EventType.CUSTOM


# ═══════════════════════════════════════════════════════════════════════
# Config tests
# ═══════════════════════════════════════════════════════════════════════

class TestConfig:
    """Tests for configuration loading."""

    def test_default_config(self):
        config = ArgusConfig(
            _env_file=None,   # don't read .env during tests
        )
        assert config.solana_rpc_url == "https://api.devnet.solana.com"
        assert config.swarm_bus_program_id == "G9ADiy7bb4bfqjEbihS8Mfaq1VSv7NvVRzyiQrFVjDSE"
        assert config.port == 8100
        assert config.adapter_github is True
        assert config.adapter_webhook is True

    def test_adapter_flags(self):
        config = ArgusConfig(
            adapter_github=False,
            adapter_figma=True,
            _env_file=None,
        )
        assert config.adapter_github is False
        assert config.adapter_figma is True


# ═══════════════════════════════════════════════════════════════════════
# Agent + HTTP tests
# ═══════════════════════════════════════════════════════════════════════

class TestAgentHTTP:
    """Integration tests for the agent's HTTP endpoints."""

    @pytest.fixture
    def client(self):
        config = ArgusConfig(
            adapter_github=True,
            adapter_figma=False,
            adapter_notion=False,
            adapter_webhook=True,
            _env_file=None,
        )
        _agent, app = build_agent(config)
        return TestClient(app)

    def test_health_endpoint(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["agent"] == "argus"
        assert data["status"] == "ok"
        assert "github" in data["adapters"]
        assert "webhook" in data["adapters"]

    def test_webhook_github_push(self, client):
        payload = json.loads(
            (FIXTURES / "sample_github_event.json").read_text()
        )
        resp = client.post(
            "/webhook/github",
            json=payload,
            headers={"x-github-event": "push"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "accepted"
        assert data["signals_emitted"] == 2

    def test_webhook_generic(self, client):
        resp = client.post(
            "/webhook/webhook",
            json={
                "project_id": "demo",
                "contributor": "tester",
                "title": "Manual test signal",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "accepted"
        assert data["signals_emitted"] == 1

    def test_signals_endpoint(self, client):
        # First emit a signal
        client.post(
            "/webhook/webhook",
            json={
                "project_id": "demo",
                "contributor": "tester",
                "title": "test",
            },
        )
        resp = client.get("/signals")
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] >= 1
        assert len(data["signals"]) >= 1

    def test_invalid_json(self, client):
        resp = client.post(
            "/webhook/github",
            content=b"not json",
            headers={
                "content-type": "application/json",
                "x-github-event": "push",
            },
        )
        assert resp.status_code == 400
