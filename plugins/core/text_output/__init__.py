"""Text Output plugin — provides terminal nodes that display received text.

Counterpart to text_input: where text_input lets the user TYPE content,
text_output DISPLAYS content received from an upstream connection. Useful
for showing the final result of a chain without going through an LLM,
for debugging a mid-chain value, or for collecting aggregated results.
"""

from .nodes import TextOutputNode

PLUGIN_MANIFEST = {
    "name": "text_output",
    "version": "1.0.0",
    "description": "Terminal node that displays text received from an upstream node",
    "author": "MindFlow",
}

NODE_CLASS_MAPPINGS = {
    "text_output": TextOutputNode,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "text_output": "Text Output",
}
