"""Tests: providers MUST NOT fall back silently. Missing credentials = explicit error."""

import pytest

from mindflow.providers.openai import OpenAIProvider
from mindflow.providers.anthropic import AnthropicProvider
from mindflow.providers.gemini import GeminiProvider
from mindflow.providers.ollama import OllamaProvider


class TestOpenAINoFallback:
    """OpenAI provider must require explicit api_key."""

    def test_no_api_key_raises_at_construction(self):
        with pytest.raises(ValueError, match="api_key"):
            OpenAIProvider(api_key=None)

    def test_empty_api_key_raises_at_construction(self):
        with pytest.raises(ValueError, match="api_key"):
            OpenAIProvider(api_key="")

    def test_valid_api_key_accepted(self):
        provider = OpenAIProvider(api_key="sk-test-key-123")
        assert provider._api_key == "sk-test-key-123"


class TestAnthropicNoFallback:
    """Anthropic provider must require explicit api_key."""

    def test_no_api_key_raises_at_construction(self):
        with pytest.raises(ValueError, match="api_key"):
            AnthropicProvider(api_key=None)

    def test_empty_api_key_raises_at_construction(self):
        with pytest.raises(ValueError, match="api_key"):
            AnthropicProvider(api_key="")

    def test_valid_api_key_accepted(self):
        provider = AnthropicProvider(api_key="sk-ant-test-key")
        assert provider._api_key == "sk-ant-test-key"


class TestGeminiNoFallback:
    """Gemini provider must require explicit api_key, no global configure."""

    def test_no_api_key_raises_at_construction(self):
        with pytest.raises(ValueError, match="api_key"):
            GeminiProvider(api_key=None)

    def test_empty_api_key_raises_at_construction(self):
        with pytest.raises(ValueError, match="api_key"):
            GeminiProvider(api_key="")

    def test_valid_api_key_accepted(self):
        provider = GeminiProvider(api_key="AIza-test-key")
        assert provider._api_key == "AIza-test-key"


class TestOllamaNoFallback:
    """Ollama provider must require explicit base_url."""

    def test_no_base_url_raises_at_construction(self):
        with pytest.raises(ValueError, match="base_url"):
            OllamaProvider(base_url=None)

    def test_empty_base_url_raises_at_construction(self):
        with pytest.raises(ValueError, match="base_url"):
            OllamaProvider(base_url="")

    def test_valid_base_url_accepted(self):
        provider = OllamaProvider(base_url="http://localhost:11434")
        assert provider.base_url == "http://localhost:11434"
