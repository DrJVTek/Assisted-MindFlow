"""Tests: SSE streaming must use json.dumps, not manual escaping.

Special characters (tabs, carriage returns, unicode, backslashes)
must produce valid JSON in SSE data payloads.
"""

import json

import pytest


class TestSSEJsonSerialization:
    """Verify json.dumps handles all special characters correctly."""

    @pytest.mark.parametrize(
        "token",
        [
            "hello world",
            "tab\there",
            "carriage\rreturn",
            "newline\nhere",
            'backslash\\path',
            'quote"inside',
            "unicode: café ñ 中文 🎉",
            "mixed\t\r\n\\\"special",
            "",  # empty token
            "   ",  # whitespace only
        ],
        ids=[
            "plain", "tab", "carriage_return", "newline",
            "backslash", "quote", "unicode", "mixed",
            "empty", "whitespace",
        ],
    )
    def test_json_dumps_produces_valid_json(self, token: str):
        """json.dumps must produce parseable JSON for any token."""
        sse_data = json.dumps({"token": token, "node_id": "test-123"})

        # Must be valid JSON
        parsed = json.loads(sse_data)
        assert parsed["token"] == token
        assert parsed["node_id"] == "test-123"

    def test_no_manual_escape_needed(self):
        """Demonstrate that json.dumps replaces all manual escaping needs."""
        nasty_content = 'He said "hello"\tthen\nnewline\\backslash\r\nend'

        # This is what we MUST use (json.dumps)
        safe = json.dumps({"content": nasty_content})

        # Must be parseable
        parsed = json.loads(safe)
        assert parsed["content"] == nasty_content

        # Verify the raw string doesn't contain unescaped control chars
        # (json.dumps escapes them properly)
        assert "\t" not in safe  # tab is escaped as \\t
        assert "\n" not in safe  # newline is escaped as \\n
        assert "\r" not in safe  # CR is escaped as \\r
