"""Unit tests for token counting utilities.

Tests cover:
- OpenAI token counting (using tiktoken)
- Claude token approximation
- Empty/short/long text handling
- Different encoding types
- Token budget calculations
"""

import pytest

from mindflow.utils.tokens import (
    count_tokens_openai,
    count_tokens_claude,
    count_tokens,
    estimate_tokens_from_messages,
    fits_in_budget,
)


class TestOpenAITokenCounting:
    """Tests for OpenAI token counting using tiktoken."""

    def test_count_empty_string(self) -> None:
        """Test counting tokens in empty string."""
        count = count_tokens_openai("")
        assert count == 0

    def test_count_single_word(self) -> None:
        """Test counting tokens in single word."""
        count = count_tokens_openai("Hello")
        assert count > 0
        assert count <= 2  # Should be 1-2 tokens

    def test_count_short_sentence(self) -> None:
        """Test counting tokens in short sentence."""
        count = count_tokens_openai("Hello, how are you?")
        assert count > 0
        assert count < 10

    def test_count_long_text(self) -> None:
        """Test counting tokens in longer text."""
        text = "The quick brown fox jumps over the lazy dog. " * 10
        count = count_tokens_openai(text)
        assert count > 50
        assert count < 200

    def test_count_with_special_characters(self) -> None:
        """Test counting tokens with special characters."""
        text = "Hello! @#$% World? 123..."
        count = count_tokens_openai(text)
        assert count > 0

    def test_count_code_snippet(self) -> None:
        """Test counting tokens in code."""
        code = """
def hello_world():
    print("Hello, World!")
    return True
"""
        count = count_tokens_openai(code)
        assert count > 10

    def test_count_unicode_text(self) -> None:
        """Test counting tokens with Unicode characters."""
        text = "Hello 世界 مرحبا Привет"
        count = count_tokens_openai(text)
        assert count > 0

    def test_count_json_text(self) -> None:
        """Test counting tokens in JSON."""
        json_text = '{"name": "test", "value": 123, "nested": {"key": "value"}}'
        count = count_tokens_openai(json_text)
        assert count > 10


class TestClaudeTokenCounting:
    """Tests for Claude token approximation."""

    def test_claude_empty_string(self) -> None:
        """Test Claude token approximation for empty string."""
        count = count_tokens_claude("")
        assert count == 0

    def test_claude_single_word(self) -> None:
        """Test Claude token approximation for single word."""
        count = count_tokens_claude("Hello")
        assert count > 0
        assert count <= 2

    def test_claude_short_sentence(self) -> None:
        """Test Claude token approximation for short sentence."""
        count = count_tokens_claude("Hello, how are you?")
        assert count > 0
        assert count < 10

    def test_claude_approximation_reasonable(self) -> None:
        """Test Claude approximation is reasonably close to OpenAI."""
        text = "The quick brown fox jumps over the lazy dog."

        openai_count = count_tokens_openai(text)
        claude_count = count_tokens_claude(text)

        # Claude approximation should be within 50% of OpenAI
        ratio = claude_count / openai_count if openai_count > 0 else 1
        assert 0.5 <= ratio <= 1.5

    def test_claude_long_text(self) -> None:
        """Test Claude approximation for longer text."""
        text = "Word " * 100
        count = count_tokens_claude(text)
        assert count > 50
        assert count < 200


class TestUnifiedTokenCounting:
    """Tests for unified count_tokens function."""

    def test_count_tokens_openai_provider(self) -> None:
        """Test count_tokens with OpenAI provider."""
        text = "Hello, world!"
        count = count_tokens(text, provider="openai")
        assert count > 0

    def test_count_tokens_claude_provider(self) -> None:
        """Test count_tokens with Claude provider."""
        text = "Hello, world!"
        count = count_tokens(text, provider="claude")
        assert count > 0

    def test_count_tokens_default_provider(self) -> None:
        """Test count_tokens with default provider."""
        text = "Hello, world!"
        count = count_tokens(text)
        assert count > 0

    def test_count_tokens_empty(self) -> None:
        """Test count_tokens with empty string."""
        assert count_tokens("", provider="openai") == 0
        assert count_tokens("", provider="claude") == 0

    def test_count_tokens_providers_similar(self) -> None:
        """Test that different providers give similar counts."""
        text = "The quick brown fox jumps over the lazy dog."

        openai_count = count_tokens(text, provider="openai")
        claude_count = count_tokens(text, provider="claude")

        # Should be within same order of magnitude
        assert abs(openai_count - claude_count) < max(openai_count, claude_count)


class TestMessageTokenEstimation:
    """Tests for estimating tokens from message arrays."""

    def test_estimate_empty_messages(self) -> None:
        """Test estimating tokens from empty message list."""
        messages = []
        count = estimate_tokens_from_messages(messages)
        assert count == 0

    def test_estimate_single_message(self) -> None:
        """Test estimating tokens from single message."""
        messages = [{"role": "user", "content": "Hello, how are you?"}]
        count = estimate_tokens_from_messages(messages)
        assert count > 0
        assert count < 20

    def test_estimate_multiple_messages(self) -> None:
        """Test estimating tokens from conversation."""
        messages = [
            {"role": "user", "content": "What is AI?"},
            {"role": "assistant", "content": "AI stands for Artificial Intelligence."},
            {"role": "user", "content": "Tell me more."},
        ]
        count = estimate_tokens_from_messages(messages)
        assert count > 10

    def test_estimate_includes_message_overhead(self) -> None:
        """Test that message estimation includes overhead for roles."""
        messages = [{"role": "user", "content": "Test"}]
        count = estimate_tokens_from_messages(messages)

        # Should be more than just content tokens (includes role overhead)
        content_only = count_tokens("Test")
        assert count >= content_only

    def test_estimate_system_message(self) -> None:
        """Test estimating tokens with system message."""
        messages = [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "Hello!"},
        ]
        count = estimate_tokens_from_messages(messages)
        assert count > 5

    def test_estimate_with_provider(self) -> None:
        """Test estimating tokens with specific provider."""
        messages = [{"role": "user", "content": "Hello"}]

        openai_count = estimate_tokens_from_messages(messages, provider="openai")
        claude_count = estimate_tokens_from_messages(messages, provider="claude")

        assert openai_count > 0
        assert claude_count > 0


class TestTokenBudget:
    """Tests for token budget checking."""

    def test_fits_in_budget_under(self) -> None:
        """Test text that fits under budget."""
        text = "Short text"
        assert fits_in_budget(text, budget=100)

    def test_fits_in_budget_exactly(self) -> None:
        """Test text that exactly matches budget."""
        text = "Hello"
        token_count = count_tokens(text)
        assert fits_in_budget(text, budget=token_count)

    def test_fits_in_budget_over(self) -> None:
        """Test text that exceeds budget."""
        text = "Word " * 1000
        assert not fits_in_budget(text, budget=10)

    def test_fits_in_budget_empty(self) -> None:
        """Test empty text always fits."""
        assert fits_in_budget("", budget=1)

    def test_fits_in_budget_zero(self) -> None:
        """Test zero budget only allows empty string."""
        assert fits_in_budget("", budget=0)
        assert not fits_in_budget("Hello", budget=0)

    def test_fits_in_budget_with_provider(self) -> None:
        """Test budget check with specific provider."""
        text = "Hello, world!"

        openai_fits = fits_in_budget(text, budget=20, provider="openai")
        claude_fits = fits_in_budget(text, budget=20, provider="claude")

        # With reasonable budget, both should fit
        assert openai_fits
        assert claude_fits


class TestEdgeCases:
    """Tests for edge cases and special inputs."""

    def test_very_long_text(self) -> None:
        """Test counting tokens in very long text."""
        text = "Word " * 10000
        count = count_tokens(text)
        assert count > 5000

    def test_only_whitespace(self) -> None:
        """Test text with only whitespace."""
        text = "   \n\n\t  "
        count = count_tokens(text)
        # Whitespace should count as minimal tokens
        assert count >= 0
        assert count < 5

    def test_repeated_characters(self) -> None:
        """Test text with many repeated characters."""
        text = "a" * 1000
        count = count_tokens(text)
        assert count > 0

    def test_newlines_and_formatting(self) -> None:
        """Test text with extensive formatting."""
        text = "Line 1\nLine 2\n\nLine 3\n\n\nLine 4"
        count = count_tokens(text)
        assert count > 5

    def test_mixed_languages(self) -> None:
        """Test text with mixed languages."""
        text = "Hello world 你好世界 مرحبا بالعالم Привет мир"
        count = count_tokens(text)
        assert count > 5
