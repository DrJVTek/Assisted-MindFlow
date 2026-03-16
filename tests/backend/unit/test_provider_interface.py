"""Tests for LLM Provider Interface — lifecycle, isolation, explicit errors."""

import pytest

from mindflow.providers.base import (
    CredentialSpec,
    LLMProvider,
    ModelInfo,
    ProgressInfo,
    ProviderResponse,
    ProviderStatus,
)


class MockProvider(LLMProvider):
    """Concrete provider for testing the interface contract."""

    def __init__(self, api_key: str = "", endpoint: str = ""):
        super().__init__()
        self.api_key = api_key
        self.endpoint = endpoint
        self._models = [
            ModelInfo(id="test-model", name="Test Model", context_length=4096),
        ]
        self._connected = False

    async def connect(self) -> None:
        if not self.api_key:
            self._status = ProviderStatus.ERROR
            self._error = "Missing required credential: api_key"
            raise PermissionError("Missing required credential: api_key")
        self._status = ProviderStatus.CONNECTED
        self._connected = True

    async def disconnect(self) -> None:
        self._connected = False
        await super().disconnect()

    async def generate(self, prompt, model, system_prompt=None, **kwargs):
        if not self._connected:
            raise ConnectionError("Provider not connected")
        return ProviderResponse(
            content=f"Response to: {prompt}",
            model=model,
            usage={"prompt_tokens": 10, "completion_tokens": 20, "total_tokens": 30},
        )

    async def stream(self, prompt, model, system_prompt=None, **kwargs):
        if not self._connected:
            raise ConnectionError("Provider not connected")
        for token in ["Hello", " ", "World"]:
            yield token

    async def list_models(self):
        return self._models

    @classmethod
    def required_credentials(cls):
        return [
            CredentialSpec(key="api_key", label="API Key", type="api_key", required=True),
        ]


class TestProviderLifecycle:
    """Test provider connection lifecycle."""

    @pytest.mark.asyncio
    async def test_initial_status_is_idle(self):
        provider = MockProvider(api_key="test-key")
        assert provider.get_status() == ProviderStatus.IDLE

    @pytest.mark.asyncio
    async def test_connect_with_valid_credentials(self):
        provider = MockProvider(api_key="test-key")
        await provider.connect()
        assert provider.get_status() == ProviderStatus.CONNECTED

    @pytest.mark.asyncio
    async def test_connect_without_credentials_raises_explicit_error(self):
        provider = MockProvider(api_key="")
        with pytest.raises(PermissionError, match="Missing required credential: api_key"):
            await provider.connect()
        assert provider.get_status() == ProviderStatus.ERROR
        assert provider.get_error() == "Missing required credential: api_key"

    @pytest.mark.asyncio
    async def test_disconnect_resets_to_idle(self):
        provider = MockProvider(api_key="test-key")
        await provider.connect()
        await provider.disconnect()
        assert provider.get_status() == ProviderStatus.IDLE


class TestProviderGeneration:
    """Test generate and stream methods."""

    @pytest.mark.asyncio
    async def test_generate_returns_provider_response(self):
        provider = MockProvider(api_key="test-key")
        await provider.connect()
        response = await provider.generate("Hello", "test-model")
        assert isinstance(response, ProviderResponse)
        assert "Hello" in response.content
        assert response.model == "test-model"
        assert response.usage is not None

    @pytest.mark.asyncio
    async def test_generate_without_connect_raises(self):
        provider = MockProvider(api_key="test-key")
        with pytest.raises(ConnectionError, match="not connected"):
            await provider.generate("Hello", "test-model")

    @pytest.mark.asyncio
    async def test_stream_yields_tokens(self):
        provider = MockProvider(api_key="test-key")
        await provider.connect()
        tokens = []
        async for token in provider.stream("Hello", "test-model"):
            tokens.append(token)
        assert tokens == ["Hello", " ", "World"]

    @pytest.mark.asyncio
    async def test_stream_without_connect_raises(self):
        provider = MockProvider(api_key="test-key")
        with pytest.raises(ConnectionError, match="not connected"):
            async for _ in provider.stream("Hello", "test-model"):
                pass


class TestProviderModelDiscovery:
    """Test list_models."""

    @pytest.mark.asyncio
    async def test_list_models_returns_model_info(self):
        provider = MockProvider(api_key="test-key")
        models = await provider.list_models()
        assert len(models) == 1
        assert models[0].id == "test-model"
        assert models[0].context_length == 4096


class TestProviderIsolation:
    """Test that two instances of the same provider type are independent."""

    @pytest.mark.asyncio
    async def test_two_instances_independent_credentials(self):
        provider_a = MockProvider(api_key="key-a")
        provider_b = MockProvider(api_key="key-b")

        await provider_a.connect()
        assert provider_a.get_status() == ProviderStatus.CONNECTED

        # provider_b has its own state
        assert provider_b.get_status() == ProviderStatus.IDLE
        assert provider_a.api_key != provider_b.api_key

    @pytest.mark.asyncio
    async def test_two_instances_independent_status(self):
        provider_a = MockProvider(api_key="key-a")
        provider_b = MockProvider(api_key="")

        await provider_a.connect()
        with pytest.raises(PermissionError):
            await provider_b.connect()

        # A is connected, B is in error — independent
        assert provider_a.get_status() == ProviderStatus.CONNECTED
        assert provider_b.get_status() == ProviderStatus.ERROR


class TestCredentialSpec:
    """Test required_credentials declaration."""

    def test_required_credentials_returns_specs(self):
        specs = MockProvider.required_credentials()
        assert len(specs) == 1
        assert specs[0].key == "api_key"
        assert specs[0].required is True


class TestProgressInfo:
    """Test progress tracking."""

    def test_initial_progress_is_none(self):
        provider = MockProvider(api_key="test")
        assert provider.get_progress() is None

    def test_progress_info_dataclass(self):
        info = ProgressInfo(percentage=50.0, tokens_generated=100, estimated_total=200)
        assert info.percentage == 50.0
