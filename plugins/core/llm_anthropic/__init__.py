"""Anthropic LLM plugin."""

from .nodes import AnthropicChatNode

PLUGIN_MANIFEST = {
    "name": "llm_anthropic",
    "version": "1.0.0",
    "description": "Anthropic Claude chat node",
    "author": "MindFlow",
    "category": "llm",
    "requires": ["anthropic"],
    "mindflow_version": "1.0.0",
}

NODE_CLASS_MAPPINGS = {
    "anthropic_chat": AnthropicChatNode,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "anthropic_chat": "Anthropic Chat",
}
