"""Text manipulation nodes for the text_tools plugin.

Each node is a small pure function over strings. They share a common
look (category "text", teal UI color) so they form a visually coherent
family in the NodeCreator.

Design notes:
- No **kwargs on execute — the orchestrator filters kwargs to the
  declared signature via inspect.signature, so unused keys like
  `provider` or `text` are dropped automatically.
- Return tuples matching RETURN_NAMES, single-element for most.
- Optional ports use sensible defaults so nodes work standalone.
"""

import re
from typing import Any

from mindflow.plugins.base import BaseNode


_TEXT_UI = {
    "color": "#00897B",   # teal — distinct from input blue, output green, llm purple
    "icon": "text",
    "min_height": 110,
}


class TextConcatNode(BaseNode):
    """Join two or three strings with a separator.

    Example usage: glue a system prompt onto a user prompt, or build a
    context string from multiple parent outputs.
    """

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "execute"
    CATEGORY = "text"
    UI = _TEXT_UI

    @classmethod
    def INPUT_TYPES(cls) -> dict:
        return {
            "required": {
                "text_a": ("STRING", {"multiline": True, "default": ""}),
                "text_b": ("STRING", {"multiline": True, "default": ""}),
            },
            "optional": {
                "text_c": ("STRING", {"multiline": True, "default": ""}),
                "separator": ("STRING", {"default": "\n"}),
            },
        }

    def execute(
        self,
        text_a: str = "",
        text_b: str = "",
        text_c: str = "",
        separator: str = "\n",
    ) -> tuple[str]:
        parts = [p for p in (text_a, text_b, text_c) if p]
        return (separator.join(parts),)


class TextSplitNode(BaseNode):
    """Split a string by separator and return one segment by index.

    Negative indexes count from the end (Python slicing). An out-of-range
    index returns an empty string rather than raising, so the node stays
    chainable even with malformed input.
    """

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("segment",)
    FUNCTION = "execute"
    CATEGORY = "text"
    UI = _TEXT_UI

    @classmethod
    def INPUT_TYPES(cls) -> dict:
        return {
            "required": {
                "text": ("STRING", {"multiline": True, "default": ""}),
                "separator": ("STRING", {"default": "\n"}),
                "index": ("INT", {"default": 0, "min": -1000, "max": 1000}),
            },
        }

    def execute(
        self,
        text: str = "",
        separator: str = "\n",
        index: int = 0,
    ) -> tuple[str]:
        if not text or not separator:
            return (text,)
        parts = text.split(separator)
        if -len(parts) <= index < len(parts):
            return (parts[index],)
        return ("",)


class TextExtractNode(BaseNode):
    """Slice a substring using Python-style [start, end) indexing.

    `end=-1` or `end=0` with start>0 is treated as "to end of string",
    so the node is easy to use for "keep first N chars" (start=0, end=N)
    or "drop first N chars" (start=N, end=-1).
    """

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "execute"
    CATEGORY = "text"
    UI = _TEXT_UI

    @classmethod
    def INPUT_TYPES(cls) -> dict:
        return {
            "required": {
                "text": ("STRING", {"multiline": True, "default": ""}),
                "start": ("INT", {"default": 0, "min": -100000, "max": 100000}),
                "end": ("INT", {"default": -1, "min": -100000, "max": 100000}),
            },
        }

    def execute(self, text: str = "", start: int = 0, end: int = -1) -> tuple[str]:
        if not text:
            return ("",)
        # end=-1 means "to the end of the string" for usability
        if end == -1 or end == 0:
            return (text[start:],)
        return (text[start:end],)


class TextRegexNode(BaseNode):
    """Apply a regex and return a capture group.

    `group=0` returns the full match; `group=1` returns the first
    capture group, etc. If the pattern doesn't match, returns empty
    string (keeps the chain alive so downstream nodes can handle it).
    """

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("match",)
    FUNCTION = "execute"
    CATEGORY = "text"
    UI = _TEXT_UI

    @classmethod
    def INPUT_TYPES(cls) -> dict:
        return {
            "required": {
                "text": ("STRING", {"multiline": True, "default": ""}),
                "pattern": ("STRING", {"default": ""}),
            },
            "optional": {
                "group": ("INT", {"default": 0, "min": 0, "max": 99}),
                "ignore_case": ("BOOLEAN", {"default": False}),
                "multiline": ("BOOLEAN", {"default": False}),
                "dotall": ("BOOLEAN", {"default": False}),
            },
        }

    def execute(
        self,
        text: str = "",
        pattern: str = "",
        group: int = 0,
        ignore_case: bool = False,
        multiline: bool = False,
        dotall: bool = False,
    ) -> tuple[str]:
        if not text or not pattern:
            return ("",)
        flags = 0
        if ignore_case:
            flags |= re.IGNORECASE
        if multiline:
            flags |= re.MULTILINE
        if dotall:
            flags |= re.DOTALL
        try:
            m = re.search(pattern, text, flags)
        except re.error as exc:
            # Invalid regex — propagate as a clear error so the
            # DetailPanel error zone shows it rather than silently
            # returning empty (which would hide the bug).
            raise ValueError(f"Invalid regex pattern: {exc}")
        if not m:
            return ("",)
        try:
            return (m.group(group),)
        except IndexError:
            return ("",)


class TextReplaceNode(BaseNode):
    """Find and replace — literal by default, regex when asked.

    Literal mode is safer for untrusted input; regex mode enables
    backreferences in the replacement string (`\\1`, `\\2`, ...).
    """

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "execute"
    CATEGORY = "text"
    UI = _TEXT_UI

    @classmethod
    def INPUT_TYPES(cls) -> dict:
        return {
            "required": {
                "text": ("STRING", {"multiline": True, "default": ""}),
                "find": ("STRING", {"default": ""}),
                "replace": ("STRING", {"default": ""}),
            },
            "optional": {
                "use_regex": ("BOOLEAN", {"default": False}),
                "ignore_case": ("BOOLEAN", {"default": False}),
            },
        }

    def execute(
        self,
        text: str = "",
        find: str = "",
        replace: str = "",
        use_regex: bool = False,
        ignore_case: bool = False,
    ) -> tuple[str]:
        if not text or not find:
            return (text,)
        if use_regex:
            flags = re.IGNORECASE if ignore_case else 0
            try:
                return (re.sub(find, replace, text, flags=flags),)
            except re.error as exc:
                raise ValueError(f"Invalid regex pattern: {exc}")
        # Literal replace. Python's str.replace has no case-insensitive
        # flag, so for ignore_case we fall back to a regex with re.escape.
        if ignore_case:
            return (re.sub(re.escape(find), replace.replace("\\", "\\\\"),
                           text, flags=re.IGNORECASE),)
        return (text.replace(find, replace),)
