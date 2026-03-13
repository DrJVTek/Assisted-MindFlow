"""OAuth session model for ChatGPT authentication.

Represents an active or persisted ChatGPT OAuth session with encrypted token storage.
"""

from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field


class OAuthSession(BaseModel):
    """Represents an active ChatGPT OAuth session."""

    access_token: str = Field(..., description="OAuth Bearer access token")
    refresh_token: str = Field(..., description="OAuth refresh token")
    expires_at: datetime = Field(..., description="Token expiry timestamp (UTC)")
    token_type: str = Field(default="Bearer", description="Token type")
    subscription_tier: Optional[str] = Field(
        default=None,
        description="Detected subscription level: free, plus, pro, business, enterprise",
    )
    user_email: Optional[str] = Field(default=None, description="OpenAI account email (display only)")
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="When the session was first created",
    )
    last_refreshed_at: Optional[datetime] = Field(
        default=None,
        description="Last successful token refresh timestamp",
    )

    def is_expired(self, buffer_minutes: int = 5) -> bool:
        """Check if the token is expired or will expire within the buffer period."""
        from datetime import timedelta

        now = datetime.now(timezone.utc)
        expiry_with_buffer = self.expires_at - timedelta(minutes=buffer_minutes)
        return now >= expiry_with_buffer

    def to_storage_dict(self) -> dict:
        """Serialize session for encrypted storage."""
        return self.model_dump(mode="json")

    @classmethod
    def from_storage_dict(cls, data: dict) -> "OAuthSession":
        """Deserialize session from encrypted storage."""
        return cls.model_validate(data)
