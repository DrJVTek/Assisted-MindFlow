"""Tests: two provider instances of the same type must never share state."""

import pytest

from mindflow.providers.gemini import GeminiProvider


class TestGeminiIsolation:
    """Two Gemini instances with different API keys must not cross-contaminate."""

    def test_different_api_keys_are_independent(self):
        """Each instance stores its own API key, no global state leakage."""
        provider_a = GeminiProvider(api_key="key-alpha")
        provider_b = GeminiProvider(api_key="key-beta")

        assert provider_a._api_key == "key-alpha"
        assert provider_b._api_key == "key-beta"
        # Creating B must not have changed A
        assert provider_a._api_key == "key-alpha"

    def test_instances_have_independent_status(self):
        """Status of one instance doesn't affect the other."""
        from mindflow.providers.base import ProviderStatus

        provider_a = GeminiProvider(api_key="key-a")
        provider_b = GeminiProvider(api_key="key-b")

        provider_a._status = ProviderStatus.ERROR
        assert provider_b.get_status() == ProviderStatus.IDLE
