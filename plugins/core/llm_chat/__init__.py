"""LLM Chat plugin — provides LLM chat nodes with dual-zone prompt/response."""

from .nodes import LLMChatNode

PLUGIN_MANIFEST = {
    "name": "llm_chat",
    "version": "1.0.0",
    "description": "LLM chat node with prompt input and streaming response",
    "author": "MindFlow",
}

NODE_CLASS_MAPPINGS = {
    "llm_chat": LLMChatNode,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "llm_chat": "LLM Chat",
}
