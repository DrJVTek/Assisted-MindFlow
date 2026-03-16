"""Gemini LLM plugin."""

from .nodes import GeminiChatNode

PLUGIN_MANIFEST = {
    "name": "llm_gemini",
    "version": "1.0.0",
    "description": "Google Gemini chat node",
    "author": "MindFlow",
    "category": "llm",
    "requires": ["google-generativeai"],
    "mindflow_version": "1.0.0",
}

NODE_CLASS_MAPPINGS = {
    "gemini_chat": GeminiChatNode,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "gemini_chat": "Gemini Chat",
}
