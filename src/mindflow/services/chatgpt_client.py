"""ChatGPT Backend API client for conversation access.

Uses an access token from the ChatGPT web session to access the
backend-api conversation endpoints. The user gets this token by
running a one-liner in their browser's ChatGPT console.

This is separate from the OpenAI API OAuth token — ChatGPT's web
backend (chatgpt.com/backend-api) and the API (api.openai.com) are
different systems with different auth.

Uses curl_cffi instead of httpx to bypass Cloudflare's TLS fingerprint
detection (JA3/JA4). httpx's Python TLS fingerprint gets blocked with
HTTP 403, while curl_cffi impersonates Chrome's TLS handshake.
"""

import json
import logging
from datetime import UTC, datetime
from pathlib import Path
from typing import Optional

from curl_cffi.requests import AsyncSession

from mindflow.models.conversation import (
    Conversation,
    ConversationMessage,
    ConversationSummary,
)

logger = logging.getLogger(__name__)

CHATGPT_BACKEND = "https://chatgpt.com/backend-api"
ACCESS_TOKEN_PATH = Path("data/oauth/chatgpt_web_token.json")

# Browser-like headers required to pass Cloudflare
BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Origin": "https://chatgpt.com",
    "Referer": "https://chatgpt.com/",
}


class ChatGPTClient:
    """Client for ChatGPT backend API (conversations, projects).

    Uses an access token obtained from chatgpt.com/api/auth/session
    to authenticate with the backend-api. The user extracts this
    token from their browser console with a simple one-liner.
    """

    def __init__(self):
        self._access_token: Optional[str] = None
        self._load_token()

    def _load_token(self) -> None:
        """Load saved access token from disk."""
        if ACCESS_TOKEN_PATH.exists():
            try:
                data = json.loads(ACCESS_TOKEN_PATH.read_text())
                self._access_token = data.get("access_token")
            except (json.JSONDecodeError, Exception) as exc:
                logger.error("Failed to load ChatGPT web token: %s", exc)

    def save_access_token(self, access_token: str) -> None:
        """Save a ChatGPT web access token."""
        ACCESS_TOKEN_PATH.parent.mkdir(parents=True, exist_ok=True)
        ACCESS_TOKEN_PATH.write_text(json.dumps({
            "access_token": access_token,
            "saved_at": datetime.now(UTC).isoformat(),
        }))
        self._access_token = access_token
        logger.info("ChatGPT web access token saved")

    def clear_token(self) -> None:
        """Remove stored access token."""
        if ACCESS_TOKEN_PATH.exists():
            ACCESS_TOKEN_PATH.unlink()
        self._access_token = None

    def has_token(self) -> bool:
        """Check if an access token is configured."""
        return bool(self._access_token)

    async def _get_headers(self) -> dict:
        """Get auth headers for ChatGPT backend API."""
        if not self._access_token:
            raise RuntimeError(
                "No ChatGPT web token configured. "
                "Open the import dialog to connect."
            )

        return {
            **BROWSER_HEADERS,
            "Authorization": f"Bearer {self._access_token}",
            "Content-Type": "application/json",
        }

    async def _request(self, method: str, url: str, **kwargs) -> dict:
        """Make an authenticated request using Chrome TLS impersonation.

        Uses curl_cffi with impersonate='chrome' to bypass Cloudflare's
        TLS fingerprint detection that blocks standard Python HTTP clients.
        """
        headers = await self._get_headers()

        async with AsyncSession(impersonate="chrome") as session:
            resp = await session.request(
                method, url, headers=headers, timeout=30, **kwargs
            )

            logger.info(
                "ChatGPT API %s %s → %d", method, url, resp.status_code
            )

            # If rejected, clear invalid token and raise clear error
            if resp.status_code in (401, 403):
                body_preview = resp.text[:500] if resp.text else "(empty)"
                logger.error(
                    "ChatGPT token rejected (%d). Response: %s",
                    resp.status_code, body_preview,
                )
                self.clear_token()
                raise RuntimeError(
                    f"ChatGPT token rejected (HTTP {resp.status_code}). "
                    "Please re-import your token via the import dialog."
                )

            if resp.status_code >= 400:
                raise RuntimeError(
                    f"ChatGPT API error (HTTP {resp.status_code}): "
                    f"{resp.text[:200] if resp.text else '(empty)'}"
                )
            return resp.json()

    async def list_conversations(
        self, offset: int = 0, limit: int = 28
    ) -> tuple[list[ConversationSummary], int]:
        """List user's ChatGPT conversations.

        Returns:
            Tuple of (conversation summaries, total count)
        """
        url = f"{CHATGPT_BACKEND}/conversations?offset={offset}&limit={limit}"
        data = await self._request("GET", url)

        items = data.get("items", [])
        total = data.get("total", len(items))

        summaries = []
        for item in items:
            created = None
            if item.get("create_time"):
                try:
                    created = datetime.fromtimestamp(item["create_time"], tz=UTC)
                except (TypeError, ValueError):
                    pass

            summaries.append(
                ConversationSummary(
                    id=item["id"],
                    title=item.get("title") or "Untitled",
                    created_at=created,
                    updated_at=None,
                    message_count=None,
                    source="chatgpt",
                )
            )

        return summaries, total

    async def get_conversation(self, conversation_id: str) -> Conversation:
        """Fetch a full conversation with its message tree."""
        url = f"{CHATGPT_BACKEND}/conversation/{conversation_id}"
        data = await self._request("GET", url)
        return self._parse_conversation(conversation_id, data)

    def _parse_conversation(self, conv_id: str, data: dict) -> Conversation:
        """Parse ChatGPT backend-api conversation response into generic model."""
        mapping = data.get("mapping", {})
        messages: dict[str, ConversationMessage] = {}
        root_id: Optional[str] = None

        for msg_id, entry in mapping.items():
            msg_data = entry.get("message")
            if not msg_data:
                # Placeholder nodes (no message content) — track for tree structure
                parent = entry.get("parent")
                children = entry.get("children", [])
                if parent is None:
                    root_id = msg_id
                messages[msg_id] = ConversationMessage(
                    id=msg_id,
                    role="system",
                    content="",
                    parent_id=parent,
                    children_ids=children,
                    timestamp=None,
                )
                continue

            role = msg_data.get("author", {}).get("role", "unknown")
            content_obj = msg_data.get("content", {})
            parts = content_obj.get("parts", [])
            # parts can contain strings or objects (for images, etc.)
            text_parts = [p for p in parts if isinstance(p, str)]
            content = "\n".join(text_parts)

            parent = entry.get("parent")
            children = entry.get("children", [])

            timestamp = None
            create_time = msg_data.get("create_time")
            if create_time:
                try:
                    timestamp = datetime.fromtimestamp(create_time, tz=UTC)
                except (TypeError, ValueError):
                    pass

            if parent is None:
                root_id = msg_id

            messages[msg_id] = ConversationMessage(
                id=msg_id,
                role=role,
                content=content,
                parent_id=parent,
                children_ids=children,
                timestamp=timestamp,
            )

        created_at = None
        if data.get("create_time"):
            try:
                created_at = datetime.fromtimestamp(data["create_time"], tz=UTC)
            except (TypeError, ValueError):
                pass

        return Conversation(
            id=conv_id,
            title=data.get("title") or "Untitled",
            source="chatgpt",
            messages=messages,
            root_id=root_id,
            current_node_id=data.get("current_node"),
            created_at=created_at,
        )
