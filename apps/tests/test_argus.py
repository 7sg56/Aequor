import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from apps.Argus.schema import WorkSignal, Platform, EventType, SignalStatus
from apps.Argus.adapters.github import GitHubAdapter
from apps.Argus.adapters.figma import FigmaAdapter
from apps.Argus.solana_writer import SolanaWriter

# ---------------------------------------------------------------------------
# Schema Tests
# ---------------------------------------------------------------------------
def test_work_signal_hashing():
    signal = WorkSignal(
        platform=Platform.GITHUB,
        event_type=EventType.COMMIT,
        project_id="Aequor",
        contributor="ishaan",
        title="Initial commit",
        event_timestamp=datetime.now(timezone.utc),
        metadata={"sha": "123456"}
    )
    
    h1 = signal.compute_content_hash()
    assert h1 is not None
    assert len(h1) == 64
    
    # Re-computing should give the same hash
    h2 = signal.compute_content_hash()
    assert h1 == h2

# ---------------------------------------------------------------------------
# Adapter Tests (Mocks)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_github_adapter_handle_webhook():
    adapter = GitHubAdapter(webhook_secret="secret")
    
    # Mock FastAPI Request
    request = MagicMock()
    # Headers in FastAPI are CaseInsensitiveDict-like, but MagicMock dict isn't.
    # The adapter calls request.headers.get("x-github-event")
    request.headers.get.side_effect = lambda k, default=None: {"x-github-event": "push"}.get(k.lower(), default)
    
    payload = {
        "repository": {"full_name": "owner/repo"},
        "sender": {"login": "user123"},
        "commits": [
            {
                "id": "abc123",
                "message": "fix: bug",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "url": "https://github.com/...",
                "author": {"username": "user123"}
            }
        ]
    }
    
    with patch.object(GitHubAdapter, "verify_signature", return_value=True):
        signals = await adapter.handle_webhook(request, payload)
    
    assert signals is not None
    assert len(signals) == 1
    assert signals[0].platform == Platform.GITHUB
    assert signals[0].event_type == EventType.COMMIT
    assert signals[0].project_id == "owner/repo"
    assert signals[0].contributor == "user123"

@pytest.mark.asyncio
async def test_figma_adapter_poll():
    adapter = FigmaAdapter(access_token="token", team_id="team123")
    # Seed seen versions so the next change is detected
    adapter._seen_versions["key123"] = "old_version"
    
    mock_projects_resp = MagicMock()
    mock_projects_resp.status_code = 200
    mock_projects_resp.json.return_value = {"projects": [{"id": "proj1"}]}
    
    mock_files_resp = MagicMock()
    mock_files_resp.status_code = 200
    mock_files_resp.json.return_value = {
        "files": [
            {
                "key": "key123",
                "name": "Design",
                "last_modified": datetime.now(timezone.utc).isoformat()
            }
        ]
    }
    
    with patch("httpx.AsyncClient.get") as mock_get:
        mock_get.side_effect = [mock_projects_resp, mock_files_resp]
        signals = await adapter.poll()
    
    assert len(signals) == 1
    assert signals[0].platform == Platform.FIGMA
    assert signals[0].project_id == "figma:team123/proj1"

# ---------------------------------------------------------------------------
# Solana Writer Tests (Mocks)
# ---------------------------------------------------------------------------
from solders.hash import Hash

@pytest.mark.asyncio
async def test_solana_writer_write_signal():
    writer = SolanaWriter(
        rpc_url="https://api.devnet.solana.com",
        program_id="G9ADiy7bb4bfqjEbihS8Mfaq1VSv7NvVRzyiQrFVjDSE",
        keypair_path="fake_path.json"
    )
    
    signal = WorkSignal(
        platform=Platform.GITHUB,
        event_type=EventType.COMMIT,
        project_id="Aequor",
        contributor="ishaan",
        title="Test commit",
        event_timestamp=datetime.now(timezone.utc)
    )
    
    # Use a real Hash object for mocking
    fake_hash = Hash.default()
    
    with patch.object(SolanaWriter, "_get_latest_blockhash", return_value=fake_hash), \
         patch.object(SolanaWriter, "_rpc_call", return_value={"result": "fake_signature"}):
        
        sig = await writer.write_signal(signal)
        assert sig == "fake_signature"
