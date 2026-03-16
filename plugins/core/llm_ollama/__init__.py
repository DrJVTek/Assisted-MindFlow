"""Ollama LLM plugin."""

from .nodes import OllamaChatNode

PLUGIN_MANIFEST = {
    "name": "llm_ollama",
    "version": "1.0.0",
    "description": "Ollama local LLM chat node",
    "author": "MindFlow",
    "category": "llm",
    "requires": [],
    "mindflow_version": "1.0.0",
}

NODE_CLASS_MAPPINGS = {
    "ollama_chat": OllamaChatNode,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "ollama_chat": "Ollama Chat",
}
