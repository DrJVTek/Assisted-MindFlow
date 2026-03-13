"""Unit tests for OAuth service PKCE logic, URL construction, and token refresh."""

import base64
import hashlib
import re
from datetime import datetime, timezone, timedelta
from pathlib import Path
from unittest.mock import AsyncMock, patch
from urllib.parse import parse_qs, urlparse

import pytest

from mindflow.models.oauth_session import OAuthSession
from mindflow.services.oauth_service import (
    AUTH_ENDPOINT,
    CLIENT_ID,
    OAuthService,
    build_authorization_url,
    generate_code_challenge,
    generate_code_verifier,
    generate_state,
)
from mindflow.services.token_storage import TokenStorage


class TestCodeVerifier:
    """Test PKCE code_verifier generation."""

    def test_length_is_base64url_of_32_bytes(self):
        verifier = generate_code_verifier()
        # 32 bytes → 43 base64url chars (no padding)
        assert len(verifier) == 43

    def test_format_is_base64url_safe(self):
        verifier = generate_code_verifier()
        # Must only contain URL-safe base64 chars (no +, /, =)
        assert re.match(r"^[A-Za-z0-9_-]+$", verifier)

    def test_no_padding_characters(self):
        verifier = generate_code_verifier()
        assert "=" not in verifier

    def test_uniqueness(self):
        verifiers = {generate_code_verifier() for _ in range(50)}
        assert len(verifiers) == 50


class TestCodeChallenge:
    """Test PKCE code_challenge derivation."""

    def test_is_sha256_of_verifier(self):
        verifier = generate_code_verifier()
        challenge = generate_code_challenge(verifier)

        # Manually compute expected challenge
        expected_digest = hashlib.sha256(verifier.encode("ascii")).digest()
        expected = base64.urlsafe_b64encode(expected_digest).rstrip(b"=").decode("ascii")

        assert challenge == expected

    def test_format_is_base64url_safe(self):
        challenge = generate_code_challenge(generate_code_verifier())
        assert re.match(r"^[A-Za-z0-9_-]+$", challenge)

    def test_no_padding_characters(self):
        challenge = generate_code_challenge(generate_code_verifier())
        assert "=" not in challenge

    def test_deterministic_for_same_verifier(self):
        verifier = generate_code_verifier()
        c1 = generate_code_challenge(verifier)
        c2 = generate_code_challenge(verifier)
        assert c1 == c2

    def test_different_for_different_verifiers(self):
        v1 = generate_code_verifier()
        v2 = generate_code_verifier()
        assert generate_code_challenge(v1) != generate_code_challenge(v2)


class TestState:
    """Test state parameter generation."""

    def test_randomness(self):
        states = {generate_state() for _ in range(50)}
        assert len(states) == 50

    def test_sufficient_length(self):
        state = generate_state()
        # secrets.token_urlsafe(32) produces ~43 chars
        assert len(state) >= 32

    def test_url_safe(self):
        state = generate_state()
        assert re.match(r"^[A-Za-z0-9_-]+$", state)


class TestAuthorizationURL:
    """Test OAuth URL construction."""

    def test_url_starts_with_auth_endpoint(self):
        url = build_authorization_url("challenge", "state123", "http://localhost:1455/auth/callback")
        assert url.startswith(AUTH_ENDPOINT)

    def test_contains_required_params(self):
        url = build_authorization_url("test_challenge", "test_state", "http://localhost:8080/auth/callback")
        parsed = urlparse(url)
        params = parse_qs(parsed.query)

        assert params["client_id"] == [CLIENT_ID]
        assert params["response_type"] == ["code"]
        assert params["code_challenge"] == ["test_challenge"]
        assert params["code_challenge_method"] == ["S256"]
        assert params["state"] == ["test_state"]
        assert params["redirect_uri"] == ["http://localhost:8080/auth/callback"]

    def test_includes_openid_scope(self):
        url = build_authorization_url("c", "s", "http://localhost:1234/auth/callback")
        parsed = urlparse(url)
        params = parse_qs(parsed.query)
        assert "openid" in params["scope"][0]


class TestTokenRefresh:
    """Test token refresh logic."""

    @pytest.fixture
    def storage_with_session(self, tmp_path: Path) -> tuple[TokenStorage, OAuthSession]:
        storage = TokenStorage(
            session_path=tmp_path / "session.enc",
            salt_path=tmp_path / ".salt",
        )
        session = OAuthSession(
            access_token="old_token",
            refresh_token="valid_refresh",
            expires_at=datetime.now(timezone.utc) - timedelta(hours=1),
            subscription_tier="plus",
            user_email="test@example.com",
        )
        storage.save_session(session)
        return storage, session

    async def test_refresh_when_token_near_expiry(self, storage_with_session):
        storage, session = storage_with_session
        service = OAuthService(token_storage=storage)

        token_data = {
            "access_token": "new_token_refreshed",
            "refresh_token": "new_refresh",
            "expires_in": 3600,
            "token_type": "Bearer",
        }

        mock_response = AsyncMock()
        mock_response.status_code = 200
        mock_response.raise_for_status = lambda: None
        mock_response.json = lambda: token_data

        with patch("mindflow.services.oauth_service.httpx.AsyncClient") as MockClient:
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_response
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = mock_client

            refreshed = await service.refresh_token(session)

            assert refreshed is not None
            assert refreshed.access_token == "new_token_refreshed"
            assert refreshed.last_refreshed_at is not None

    async def test_refresh_with_invalid_refresh_token(self, tmp_path: Path):
        storage = TokenStorage(
            session_path=tmp_path / "session.enc",
            salt_path=tmp_path / ".salt",
        )
        session = OAuthSession(
            access_token="old_token",
            refresh_token="invalid_refresh",
            expires_at=datetime.now(timezone.utc) - timedelta(hours=1),
        )
        storage.save_session(session)
        service = OAuthService(token_storage=storage)

        with patch("mindflow.services.oauth_service.httpx.AsyncClient") as MockClient:
            mock_client = AsyncMock()
            mock_client.post.side_effect = Exception("invalid_grant")
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = mock_client

            result = await service.refresh_token(session)
            assert result is None

    async def test_refresh_returns_none_when_no_session(self, tmp_path: Path):
        storage = TokenStorage(
            session_path=tmp_path / "empty.enc",
            salt_path=tmp_path / ".salt",
        )
        service = OAuthService(token_storage=storage)
        result = await service.refresh_token()
        assert result is None


class TestDeviceCodeFlow:
    """Test device code flow logic."""

    async def test_device_code_request(self, tmp_path: Path):
        storage = TokenStorage(
            session_path=tmp_path / "session.enc",
            salt_path=tmp_path / ".salt",
        )
        service = OAuthService(token_storage=storage)

        device_data = {
            "device_code": "test_device_code",
            "user_code": "ABCD-1234",
            "verification_uri": "https://auth.openai.com/activate",
            "expires_in": 900,
            "interval": 5,
        }

        mock_response = AsyncMock()
        mock_response.status_code = 200
        mock_response.raise_for_status = lambda: None
        mock_response.json = lambda: device_data

        with patch("mindflow.services.oauth_service.httpx.AsyncClient") as MockClient:
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_response
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = mock_client

            # Patch asyncio.create_task to avoid background polling
            with patch("mindflow.services.oauth_service.asyncio.create_task"):
                result = await service.start_device_code_flow()

        assert result["user_code"] == "ABCD-1234"
        assert result["verification_uri"] == "https://auth.openai.com/activate"
        assert result["expires_in"] == 900

    async def test_device_code_raises_when_flow_in_progress(self, tmp_path: Path):
        storage = TokenStorage(
            session_path=tmp_path / "session.enc",
            salt_path=tmp_path / ".salt",
        )
        service = OAuthService(token_storage=storage)
        service._flow_in_progress = True

        with pytest.raises(RuntimeError, match="already in progress"):
            await service.start_device_code_flow()


class TestSessionStatus:
    """Test session status reporting."""

    def test_not_connected_when_no_session(self, tmp_path: Path):
        storage = TokenStorage(
            session_path=tmp_path / "empty.enc",
            salt_path=tmp_path / ".salt",
        )
        service = OAuthService(token_storage=storage)
        status = service.get_session_status()
        assert status["status"] == "not_connected"

    def test_connected_when_valid_session(self, tmp_path: Path):
        storage = TokenStorage(
            session_path=tmp_path / "session.enc",
            salt_path=tmp_path / ".salt",
        )
        session = OAuthSession(
            access_token="valid_token",
            refresh_token="valid_refresh",
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
            subscription_tier="plus",
            user_email="test@example.com",
        )
        storage.save_session(session)
        service = OAuthService(token_storage=storage)

        status = service.get_session_status()
        assert status["status"] == "connected"
        assert status["subscription_tier"] == "plus"

    def test_expired_when_token_expired(self, tmp_path: Path):
        storage = TokenStorage(
            session_path=tmp_path / "session.enc",
            salt_path=tmp_path / ".salt",
        )
        session = OAuthSession(
            access_token="old_token",
            refresh_token="valid_refresh",
            expires_at=datetime.now(timezone.utc) - timedelta(hours=1),
        )
        storage.save_session(session)
        service = OAuthService(token_storage=storage)

        status = service.get_session_status()
        assert status["status"] == "session_expired"
        assert status["needs_reauth"] is True
