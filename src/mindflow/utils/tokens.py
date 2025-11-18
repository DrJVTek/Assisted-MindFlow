"""Token counting utilities for MindFlow Engine.

This module provides functions to count tokens for different LLM providers,
which is essential for context management and budget enforcement.
"""

from typing import Any, Dict, List, Literal

import tiktoken


ProviderType = Literal["openai", "claude", "mistral", "groq"]


def count_tokens_openai(text: str, model: str = "gpt-4") -> int:
    """Count tokens using OpenAI's tiktoken library.

    This provides exact token counts for OpenAI models.

    Args:
        text: Text to count tokens for
        model: OpenAI model name (default: gpt-4)

    Returns:
        Number of tokens in the text

    Example:
        >>> count_tokens_openai("Hello, world!")
        4
    """
    if not text:
        return 0

    try:
        encoding = tiktoken.encoding_for_model(model)
    except KeyError:
        # Fallback to cl100k_base for newer models
        encoding = tiktoken.get_encoding("cl100k_base")

    return len(encoding.encode(text))


def count_tokens_claude(text: str) -> int:
    """Approximate token count for Claude models.

    Claude uses a similar tokenizer to OpenAI, so we use tiktoken
    with cl100k_base encoding as an approximation.

    Args:
        text: Text to count tokens for

    Returns:
        Approximate number of tokens

    Example:
        >>> count_tokens_claude("Hello, world!")
        4
    """
    if not text:
        return 0

    # Use cl100k_base as approximation for Claude
    encoding = tiktoken.get_encoding("cl100k_base")
    return len(encoding.encode(text))


def count_tokens(text: str, provider: ProviderType = "openai") -> int:
    """Count tokens for any LLM provider.

    Unified interface for token counting across different providers.

    Args:
        text: Text to count tokens for
        provider: LLM provider type

    Returns:
        Number of tokens in the text

    Example:
        >>> count_tokens("Hello, world!", provider="claude")
        4
    """
    if not text:
        return 0

    if provider == "openai":
        return count_tokens_openai(text)
    elif provider == "claude":
        return count_tokens_claude(text)
    elif provider in ("mistral", "groq"):
        # Mistral and Groq use similar tokenization to OpenAI
        return count_tokens_openai(text)
    else:
        # Default fallback
        return count_tokens_openai(text)


def estimate_tokens_from_messages(
    messages: List[Dict[str, Any]], provider: ProviderType = "openai"
) -> int:
    """Estimate token count from a message array.

    Accounts for message structure overhead (roles, formatting).

    Args:
        messages: List of message dicts with "role" and "content"
        provider: LLM provider type

    Returns:
        Estimated total tokens including overhead

    Example:
        >>> messages = [
        ...     {"role": "user", "content": "Hello!"},
        ...     {"role": "assistant", "content": "Hi there!"}
        ... ]
        >>> estimate_tokens_from_messages(messages)
        15  # Includes message overhead
    """
    if not messages:
        return 0

    total_tokens = 0

    for message in messages:
        role = message.get("role", "")
        content = message.get("content", "")

        # Count tokens for role (usually 1-2 tokens)
        total_tokens += count_tokens(role, provider)

        # Count tokens for content
        total_tokens += count_tokens(content, provider)

        # Add overhead for message structure (typically 3-4 tokens per message)
        total_tokens += 4

    # Add overhead for message array structure
    total_tokens += 3

    return total_tokens


def fits_in_budget(
    text: str, budget: int, provider: ProviderType = "openai"
) -> bool:
    """Check if text fits within a token budget.

    Args:
        text: Text to check
        budget: Maximum allowed tokens
        provider: LLM provider type

    Returns:
        True if text fits in budget, False otherwise

    Example:
        >>> fits_in_budget("Short text", budget=100)
        True
        >>> fits_in_budget("x" * 10000, budget=10)
        False
    """
    if budget <= 0:
        return not text  # Only empty string fits in zero budget

    token_count = count_tokens(text, provider)
    return token_count <= budget


def calculate_remaining_budget(
    used_tokens: int, max_budget: int
) -> int:
    """Calculate remaining token budget.

    Args:
        used_tokens: Tokens already used
        max_budget: Maximum token budget

    Returns:
        Remaining tokens available (0 if budget exceeded)

    Example:
        >>> calculate_remaining_budget(100, 500)
        400
        >>> calculate_remaining_budget(600, 500)
        0
    """
    remaining = max_budget - used_tokens
    return max(0, remaining)
