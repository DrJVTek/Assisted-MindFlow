"""OpenAI LLM plugin."""

from .nodes import OpenAIChatNode

PLUGIN_MANIFEST = {
    "name": "llm_openai",
    "version": "1.0.0",
    "description": "OpenAI GPT chat node",
    "author": "MindFlow",
    "category": "llm",
    "requires": ["openai"],
    "mindflow_version": "1.0.0",
}

NODE_CLASS_MAPPINGS = {
    "openai_chat": OpenAIChatNode,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "openai_chat": "OpenAI Chat",
}
