"""TextInputNode — static text input node (replaces old "note" type).

A simple node that takes user-entered text and outputs it as a STRING.
No LLM interaction, no credentials needed.
"""

from mindflow.plugins.base import BaseNode


class TextInputNode(BaseNode):
    """Static text input node.

    Users type text into this node. It passes the text through as a STRING
    output that can be connected to other nodes (e.g., as prompt input
    to an LLM node).
    """

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "execute"
    CATEGORY = "input"
    UI = {
        "color": "#4A90D9",
        "icon": "text",
        "min_height": 120,
    }

    @classmethod
    def INPUT_TYPES(cls) -> dict:
        return {
            "required": {
                "text": ("STRING", {"multiline": True, "default": ""}),
            },
        }

    def execute(self, text: str = "") -> tuple[str]:
        """Pass through the user's text."""
        return (text,)
