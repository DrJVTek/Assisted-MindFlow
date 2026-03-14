"""Integration tests for provider-aware LLM operation creation.

Tests the workflow of creating a provider via the providers API and then
using that provider_id when creating an LLM operation.
"""

import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from fastapi.testclient import TestClient

from mindflow.api.server import app
from mindflow.services.provider_registry import ProviderRegistry


@pytest.fixture(autouse=True)
def _isolated_registry(tmp_path):
    """Replace the global provider registry with a fresh temp-backed instance."""
    registry = ProviderRegistry(
        providers_file=tmp_path / "providers.json",
        secret_storage=MagicMock(),
    )
    registry._secret_storage.save_credentials = MagicMock()
    registry._secret_storage.get_credentials = MagicMock(return_value=None)
    registry._secret_storage.delete_credentials = MagicMock(return_value=True)

    with patch("mindflow.api.routes.providers._registry", registry):
        with patch("mindflow.api.routes.providers._get_registry", return_value=registry):
            yield registry


@pytest.fixture(autouse=True)
def _isolated_state_manager():
    """Provide a mock OperationStateManager so we don't need SQLite/Redis."""
    mock_manager = MagicMock()

    async def mock_create_operation(**kwargs):
        """Return a mock LLMOperation with the fields the endpoint needs."""
        from uuid import uuid4
        mock_op = MagicMock()
        mock_op.id = uuid4()
        mock_op.node_id = kwargs.get("node_id")
        mock_op.status = MagicMock()
        mock_op.status.value = "queued"
        mock_op.progress = 0
        mock_op.queue_position = 0
        mock_op.content_length = 0
        mock_op.started_at = None
        mock_op.completed_at = None
        mock_op.error_message = None
        mock_op.provider = kwargs.get("provider", "openai")
        mock_op.model = kwargs.get("model", "gpt-4o")
        mock_op.prompt = kwargs.get("prompt", "")
        mock_op.system_prompt = kwargs.get("system_prompt")
        mock_op.metadata = kwargs.get("metadata", {})
        return mock_op

    mock_manager.create_operation = AsyncMock(side_effect=mock_create_operation)

    with patch("mindflow.api.routes.llm_operations.state_manager", mock_manager):
        yield mock_manager


@pytest.fixture
def client():
    return TestClient(app)


def _openai_provider_payload() -> dict:
    return {
        "name": "Integration OpenAI",
        "type": "openai",
        "color": "#10A37F",
        "api_key": "sk-integration-test",
    }


class TestProviderAwareOperationCreation:
    """Create a provider, then create an LLM operation referencing it."""

    def test_create_operation_with_provider_id(
        self, client: TestClient, _isolated_state_manager
    ):
        """Full flow: register provider -> create operation with provider_id."""
        # Step 1: Create a provider
        provider_resp = client.post("/api/providers", json=_openai_provider_payload())
        assert provider_resp.status_code == 201
        provider_id = provider_resp.json()["id"]

        # Step 2: Create an LLM operation referencing the provider
        from uuid import uuid4

        graph_id = str(uuid4())
        node_id = str(uuid4())

        op_payload = {
            "node_id": node_id,
            "provider": "openai",
            "provider_id": provider_id,
            "model": "gpt-4o",
            "prompt": "Hello, world!",
        }

        op_resp = client.post(
            f"/api/llm-operations/graphs/{graph_id}/operations",
            json=op_payload,
        )
        assert op_resp.status_code == 200
        op_data = op_resp.json()
        assert "id" in op_data
        assert op_data["status"] == "queued"
        assert op_data["node_id"] == node_id

        # Verify create_operation was called with correct args
        _isolated_state_manager.create_operation.assert_called_once()
        call_kwargs = _isolated_state_manager.create_operation.call_args[1]
        assert call_kwargs["provider"] == "openai"
        assert call_kwargs["model"] == "gpt-4o"
        assert call_kwargs["prompt"] == "Hello, world!"

    def test_create_operation_without_provider_id(
        self, client: TestClient, _isolated_state_manager
    ):
        """Operations can still be created without a provider_id (legacy mode)."""
        from uuid import uuid4

        graph_id = str(uuid4())
        node_id = str(uuid4())

        op_payload = {
            "node_id": node_id,
            "provider": "anthropic",
            "model": "claude-sonnet-4-20250514",
            "prompt": "Summarize this",
        }

        op_resp = client.post(
            f"/api/llm-operations/graphs/{graph_id}/operations",
            json=op_payload,
        )
        assert op_resp.status_code == 200
        assert op_resp.json()["status"] == "queued"

    def test_provider_exists_after_operation_creation(
        self, client: TestClient, _isolated_state_manager
    ):
        """Provider remains accessible after an operation references it."""
        # Create provider
        provider_resp = client.post("/api/providers", json=_openai_provider_payload())
        provider_id = provider_resp.json()["id"]

        # Create operation referencing it
        from uuid import uuid4

        op_payload = {
            "node_id": str(uuid4()),
            "provider": "openai",
            "provider_id": provider_id,
            "model": "gpt-4o",
            "prompt": "Test prompt",
        }
        client.post(
            f"/api/llm-operations/graphs/{uuid4()}/operations",
            json=op_payload,
        )

        # Provider should still be retrievable
        get_resp = client.get(f"/api/providers/{provider_id}")
        assert get_resp.status_code == 200
        assert get_resp.json()["id"] == provider_id
        assert get_resp.json()["name"] == "Integration OpenAI"
