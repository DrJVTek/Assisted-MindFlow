"""Text Tools plugin — string manipulation utility nodes.

A family of small, focused nodes for building text pipelines:
- TextConcat:  join strings with an optional separator
- TextSplit:   cut a string by separator and pick the nth piece
- TextExtract: slice a substring by [start, end)
- TextRegex:   apply a regex and return a capture group
- TextReplace: find-and-replace (literal or regex)

Each is a pure function with no side effects and no LLM dependency.
They chain cleanly together for preprocessing prompts, postprocessing
LLM responses, or transforming context between LLM nodes.
"""

from .nodes import (
    TextConcatNode,
    TextSplitNode,
    TextExtractNode,
    TextRegexNode,
    TextReplaceNode,
)

PLUGIN_MANIFEST = {
    "name": "text_tools",
    "version": "1.0.0",
    "description": "Text manipulation utilities (concat, split, extract, regex, replace)",
    "author": "MindFlow",
}

NODE_CLASS_MAPPINGS = {
    "text_concat": TextConcatNode,
    "text_split": TextSplitNode,
    "text_extract": TextExtractNode,
    "text_regex": TextRegexNode,
    "text_replace": TextReplaceNode,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "text_concat": "Text Concat",
    "text_split": "Text Split",
    "text_extract": "Text Extract",
    "text_regex": "Text Regex",
    "text_replace": "Text Replace",
}
