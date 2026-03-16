"""Text Input plugin — provides static text input nodes."""

from .nodes import TextInputNode

PLUGIN_MANIFEST = {
    "name": "text_input",
    "version": "1.0.0",
    "description": "Static text input node for user-entered content",
    "author": "MindFlow",
}

NODE_CLASS_MAPPINGS = {
    "text_input": TextInputNode,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "text_input": "Text Input",
}
