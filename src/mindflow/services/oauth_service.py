"""Generic OAuth service for provider authentication.

Handles PKCE code generation, state parameters, OAuth URL construction,
temporary callback server, token exchange, and token refresh.

Supports multiple OAuth provider configs (OpenAI, future Anthropic, Google, etc.).
"""

import asyncio
import base64
import hashlib
import http.server
import json
import logging
import os
import secrets
import threading
import webbrowser
from datetime import datetime, timedelta, timezone
from typing import Optional
from urllib.parse import parse_qs, urlencode, urlparse

import httpx
from pydantic import BaseModel

from mindflow.models.oauth_session import OAuthSession
from mindflow.models.provider import ProviderType
from mindflow.services.token_storage import TokenStorage

logger = logging.getLogger(__name__)

# PKCE constants
CODE_VERIFIER_BYTES = 32
LOGIN_TIMEOUT_SECONDS = 120


# ── OAuth Provider Configs ──────────────────────────────────────────


class OAuthProviderConfig(BaseModel):
    """OAuth configuration for a specific provider type."""

    auth_endpoint: str
    token_endpoint: str
    device_code_endpoint: Optional[str] = None
    client_id: str
    scopes: str = "openid profile email offline_access"
    extra_params: dict = {}


# Registry of known OAuth configs per provider type
OAUTH_CONFIGS: dict[ProviderType, OAuthProviderConfig] = {
    ProviderType.OPENAI: OAuthProviderConfig(
        auth_endpoint="https://auth.openai.com/oauth/authorize",
        token_endpoint="https://auth.openai.com/oauth/token",
        device_code_endpoint="https://auth.openai.com/oauth/device/code",
        client_id="app_EMoamEEZ73f0CkXaXp7hrann",
        scopes="openid profile email offline_access",
        extra_params={
            "id_token_add_organizations": "true",
            "codex_cli_simplified_flow": "true",
            "originator": "codex_cli_rs",
        },
    ),
    ProviderType.CHATGPT_WEB: OAuthProviderConfig(
        auth_endpoint="https://auth.openai.com/oauth/authorize",
        token_endpoint="https://auth.openai.com/oauth/token",
        device_code_endpoint="https://auth.openai.com/oauth/device/code",
        client_id="app_EMoamEEZ73f0CkXaXp7hrann",
        scopes="openid profile email offline_access",
        extra_params={
            "id_token_add_organizations": "true",
            "codex_cli_simplified_flow": "true",
            "originator": "codex_cli_rs",
        },
    ),
    # Future: add Anthropic, Google OAuth configs here
}


def get_oauth_config(provider_type: ProviderType) -> Optional[OAuthProviderConfig]:
    """Get the OAuth config for a provider type, or None if OAuth is not supported."""
    return OAUTH_CONFIGS.get(provider_type)


# ── PKCE Helpers ──────────────────────────────────────────────────


def generate_code_verifier() -> str:
    """Generate a PKCE code_verifier (32 random bytes, base64url-encoded, no padding)."""
    random_bytes = os.urandom(CODE_VERIFIER_BYTES)
    return base64.urlsafe_b64encode(random_bytes).rstrip(b"=").decode("ascii")


def generate_code_challenge(code_verifier: str) -> str:
    """Compute the PKCE code_challenge (SHA256 of verifier, base64url-encoded, no padding)."""
    digest = hashlib.sha256(code_verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


def generate_state() -> str:
    """Generate a random state parameter for CSRF protection."""
    return secrets.token_urlsafe(32)


# ── Callback Handler ──────────────────────────────────────────────


class OAuthCallbackHandler(http.server.BaseHTTPRequestHandler):
    """HTTP request handler that captures the OAuth callback code."""

    auth_code: Optional[str] = None
    received_state: Optional[str] = None
    error: Optional[str] = None

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)

        if parsed.path == "/auth/callback":
            if "error" in params:
                OAuthCallbackHandler.error = params["error"][0]
                self._respond(400, "Authentication failed. You can close this window.")
            elif "code" in params:
                OAuthCallbackHandler.auth_code = params["code"][0]
                OAuthCallbackHandler.received_state = params.get("state", [None])[0]
                self._respond(200, "Authentication successful! You can close this window.")
            else:
                self._respond(400, "Missing authorization code.")
        else:
            self._respond(404, "Not found")

    def _respond(self, status: int, message: str) -> None:
        self.send_response(status)
        self.send_header("Content-Type", "text/html")
        self.end_headers()
        html = f"<html><body><h2>{message}</h2></body></html>"
        self.wfile.write(html.encode("utf-8"))

    def log_message(self, format: str, *args: object) -> None:
        """Suppress default HTTP server logging."""
        pass


# ── OAuth Service ──────────────────────────────────────────────────


class OAuthService:
    """Orchestrates the full OAuth flow for any provider.

    Each OAuthService instance is bound to a specific provider (by provider_id)
    and uses the matching OAuthProviderConfig for endpoints/client_id.
    """

    def __init__(
        self,
        provider_id: str,
        oauth_config: OAuthProviderConfig,
        token_storage: Optional[TokenStorage] = None,
    ):
        self._provider_id = provider_id
        self._config = oauth_config
        self._storage = token_storage or TokenStorage()
        self._flow_in_progress = False
        self._callback_server: Optional[http.server.HTTPServer] = None

    @property
    def provider_id(self) -> str:
        return self._provider_id

    @property
    def flow_in_progress(self) -> bool:
        return self._flow_in_progress

    def _build_authorization_url(
        self,
        code_challenge: str,
        state: str,
        redirect_uri: str,
    ) -> str:
        """Construct the full OAuth authorization URL."""
        params = {
            "client_id": self._config.client_id,
            "response_type": "code",
            "redirect_uri": redirect_uri,
            "scope": self._config.scopes,
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
            "state": state,
            **self._config.extra_params,
        }
        return f"{self._config.auth_endpoint}?{urlencode(params)}"

    async def start_login_flow(self) -> dict:
        """Start the browser-based OAuth login flow.

        Returns a dict with status information.
        """
        if self._flow_in_progress:
            raise RuntimeError("Login flow already in progress")

        self._flow_in_progress = True
        try:
            code_verifier = generate_code_verifier()
            code_challenge = generate_code_challenge(code_verifier)
            state = generate_state()

            # Reset handler state
            OAuthCallbackHandler.auth_code = None
            OAuthCallbackHandler.received_state = None
            OAuthCallbackHandler.error = None

            # Start temporary callback server (port 1455 matches Codex CLI default)
            try:
                server = http.server.HTTPServer(("127.0.0.1", 1455), OAuthCallbackHandler)
            except OSError:
                server = http.server.HTTPServer(("127.0.0.1", 0), OAuthCallbackHandler)
            port = server.server_address[1]
            self._callback_server = server

            redirect_uri = f"http://localhost:{port}/auth/callback"
            auth_url = self._build_authorization_url(code_challenge, state, redirect_uri)

            # Run server in a background thread
            server_thread = threading.Thread(target=server.handle_request, daemon=True)
            server_thread.start()

            # Open browser
            webbrowser.open(auth_url)
            logger.info(
                "Browser opened for OAuth (provider=%s). Waiting for callback on port %d",
                self._provider_id, port,
            )

            # Wait for callback (with timeout)
            server_thread.join(timeout=LOGIN_TIMEOUT_SECONDS)

            if server_thread.is_alive():
                server.shutdown()
                self._flow_in_progress = False
                return {"status": "timeout", "message": "Authentication timed out."}

            if OAuthCallbackHandler.error:
                self._flow_in_progress = False
                return {
                    "status": "error",
                    "message": f"Authentication error: {OAuthCallbackHandler.error}",
                }

            if not OAuthCallbackHandler.auth_code:
                self._flow_in_progress = False
                return {"status": "error", "message": "No authorization code received."}

            # Validate state
            if OAuthCallbackHandler.received_state != state:
                self._flow_in_progress = False
                return {"status": "error", "message": "State parameter mismatch (CSRF protection)."}

            # Exchange code for tokens
            session = await self._exchange_code(
                code=OAuthCallbackHandler.auth_code,
                code_verifier=code_verifier,
                redirect_uri=redirect_uri,
            )

            self._storage.save_session(session, self._provider_id)
            self._flow_in_progress = False

            return {
                "status": "connected",
                "subscription_tier": session.subscription_tier,
                "user_email": session.user_email,
            }

        except Exception as exc:
            self._flow_in_progress = False
            logger.exception("OAuth login flow failed for provider %s", self._provider_id)
            return {"status": "error", "message": str(exc)}

    async def _exchange_code(
        self,
        code: str,
        code_verifier: str,
        redirect_uri: str,
    ) -> OAuthSession:
        """Exchange authorization code for access/refresh tokens."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self._config.token_endpoint,
                data={
                    "grant_type": "authorization_code",
                    "client_id": self._config.client_id,
                    "code": code,
                    "code_verifier": code_verifier,
                    "redirect_uri": redirect_uri,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            response.raise_for_status()
            data = response.json()

        expires_in = data.get("expires_in", 3600)
        now = datetime.now(timezone.utc)

        return OAuthSession(
            provider_id=self._provider_id,
            access_token=data["access_token"],
            refresh_token=data.get("refresh_token", ""),
            expires_at=now + timedelta(seconds=expires_in),
            token_type=data.get("token_type", "Bearer"),
            subscription_tier=self._detect_tier(data),
            user_email=data.get("email"),
            created_at=now,
        )

    async def refresh_token(self, session: Optional[OAuthSession] = None) -> Optional[OAuthSession]:
        """Refresh an expired or near-expired OAuth session."""
        session = session or self._storage.load_session(self._provider_id)
        if not session or not session.refresh_token:
            return None

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self._config.token_endpoint,
                    data={
                        "grant_type": "refresh_token",
                        "client_id": self._config.client_id,
                        "refresh_token": session.refresh_token,
                    },
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                )
                response.raise_for_status()
                data = response.json()

            expires_in = data.get("expires_in", 3600)
            now = datetime.now(timezone.utc)

            refreshed = OAuthSession(
                provider_id=self._provider_id,
                access_token=data["access_token"],
                refresh_token=data.get("refresh_token", session.refresh_token),
                expires_at=now + timedelta(seconds=expires_in),
                token_type=data.get("token_type", "Bearer"),
                subscription_tier=session.subscription_tier,
                user_email=session.user_email,
                created_at=session.created_at,
                last_refreshed_at=now,
            )

            self._storage.save_session(refreshed, self._provider_id)
            logger.info("OAuth token refreshed for provider %s", self._provider_id)
            return refreshed

        except Exception as exc:
            logger.error("Token refresh failed for provider %s: %s", self._provider_id, exc)
            return None

    async def get_valid_token(self) -> Optional[str]:
        """Get a valid access token, refreshing if needed."""
        session = self._storage.load_session(self._provider_id)
        if not session:
            return None

        if session.is_expired():
            session = await self.refresh_token(session)
            if not session:
                return None

        return session.access_token

    def get_session_status(self) -> dict:
        """Get the current OAuth session status."""
        session = self._storage.load_session(self._provider_id)

        if not session:
            return {"status": "not_connected"}

        if session.is_expired(buffer_minutes=0):
            return {
                "status": "session_expired",
                "needs_reauth": True,
                "user_email": session.user_email,
                "subscription_tier": session.subscription_tier,
            }

        return {
            "status": "connected",
            "subscription_tier": session.subscription_tier,
            "user_email": session.user_email,
            "expires_at": session.expires_at.isoformat(),
        }

    def logout(self) -> dict:
        """Clear the current OAuth session."""
        self._storage.delete_session(self._provider_id)
        return {"status": "signed_out", "message": "OAuth session cleared."}

    async def start_device_code_flow(self) -> dict:
        """Start the device code authentication flow (for headless environments)."""
        if not self._config.device_code_endpoint:
            raise RuntimeError("Device code flow not supported for this provider")

        if self._flow_in_progress:
            raise RuntimeError("Login flow already in progress")

        self._flow_in_progress = True
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self._config.device_code_endpoint,
                    data={
                        "client_id": self._config.client_id,
                        "scope": self._config.scopes,
                    },
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                )
                response.raise_for_status()
                data = response.json()

            device_code = data["device_code"]
            user_code = data["user_code"]
            verification_uri = data.get("verification_uri", "")
            expires_in = data.get("expires_in", 900)
            interval = data.get("interval", 5)

            # Start polling in background
            asyncio.create_task(
                self._poll_device_code(device_code, interval, expires_in)
            )

            return {
                "user_code": user_code,
                "verification_uri": verification_uri,
                "expires_in": expires_in,
                "interval": interval,
            }

        except Exception as exc:
            self._flow_in_progress = False
            logger.exception("Device code flow failed for provider %s", self._provider_id)
            raise RuntimeError(f"Failed to start device code flow: {exc}") from exc

    async def _poll_device_code(
        self, device_code: str, interval: int, expires_in: int
    ) -> None:
        """Poll the token endpoint until the device code is authorized or expires."""
        import time

        deadline = time.monotonic() + expires_in

        try:
            async with httpx.AsyncClient() as client:
                while time.monotonic() < deadline:
                    await asyncio.sleep(interval)

                    response = await client.post(
                        self._config.token_endpoint,
                        data={
                            "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
                            "client_id": self._config.client_id,
                            "device_code": device_code,
                        },
                        headers={"Content-Type": "application/x-www-form-urlencoded"},
                    )

                    if response.status_code == 200:
                        data = response.json()
                        now = datetime.now(timezone.utc)
                        session = OAuthSession(
                            provider_id=self._provider_id,
                            access_token=data["access_token"],
                            refresh_token=data.get("refresh_token", ""),
                            expires_at=now + timedelta(seconds=data.get("expires_in", 3600)),
                            token_type=data.get("token_type", "Bearer"),
                            subscription_tier=self._detect_tier(data),
                            user_email=data.get("email"),
                            created_at=now,
                        )
                        self._storage.save_session(session, self._provider_id)
                        logger.info("Device code flow: authorized for provider %s", self._provider_id)
                        self._flow_in_progress = False
                        return

                    error_data = response.json() if response.content else {}
                    error = error_data.get("error", "")
                    if error == "authorization_pending":
                        continue
                    elif error == "slow_down":
                        interval += 5
                        continue
                    else:
                        logger.error("Device code poll error for provider %s: %s", self._provider_id, error)
                        break

            logger.warning("Device code flow timed out for provider %s", self._provider_id)
        except Exception as exc:
            logger.exception("Device code polling failed for provider %s: %s", self._provider_id, exc)
        finally:
            self._flow_in_progress = False

    def _detect_tier(self, token_data: dict) -> Optional[str]:
        """Attempt to detect subscription tier from token response metadata."""
        return token_data.get("subscription_tier")
