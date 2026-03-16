"""ChatGPT Web LLM plugin — OAuth-based ChatGPT with conversation/project import."""

from .nodes import ChatGPTWebNode

PLUGIN_MANIFEST = {
    "name": "llm_chatgpt_web",
    "version": "1.0.0",
    "description": "ChatGPT Web node with OAuth and conversation/project import",
    "author": "MindFlow",
    "category": "llm",
    "requires": [],
    "mindflow_version": "1.0.0",
}

NODE_CLASS_MAPPINGS = {
    "chatgpt_web_chat": ChatGPTWebNode,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "chatgpt_web_chat": "ChatGPT Web",
}
