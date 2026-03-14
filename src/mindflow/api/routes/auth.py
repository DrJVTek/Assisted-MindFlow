"""Authentication API routes for ChatGPT OAuth.

Provides endpoints for:
- POST /api/auth/openai/login — Start OAuth browser flow
- GET  /api/auth/openai/status — Get session status
- POST /api/auth/openai/logout — Clear session
- PUT  /api/auth/openai/method — Switch auth method
- GET  /api/auth/openai/models — List available models
- PUT  /api/auth/openai/model — Select model
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from mindflow.services.oauth_service import OAuthService
from mindflow.services.token_storage import TokenStorage

VALID_AUTH_METHODS = {"api_key", "chatgpt_oauth"}

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth/openai", tags=["auth"])

# Singleton service instances
_token_storage = TokenStorage()
_oauth_service = OAuthService(_token_storage)


def get_oauth_service() -> OAuthService:
    """Get the OAuth service singleton."""
    return _oauth_service


# ============================================================================
# Response Models
# ============================================================================


class LoginResponse(BaseModel):
    status: str
    message: Optional[str] = None
    timeout_seconds: Optional[int] = None
    subscription_tier: Optional[str] = None
    user_email: Optional[str] = None


class StatusResponse(BaseModel):
    auth_method: str = "chatgpt_oauth"
    status: str
    subscription_tier: Optional[str] = None
    user_email: Optional[str] = None
    expires_at: Optional[str] = None
    needs_reauth: Optional[bool] = None


class LogoutResponse(BaseModel):
    status: str
    message: str


class SwitchMethodRequest(BaseModel):
    auth_method: str


class SwitchMethodResponse(BaseModel):
    auth_method: str
    status: str
    message: str


class ModelInfo(BaseModel):
    id: str
    name: str
    available: bool = True


class ModelsResponse(BaseModel):
    models: List[ModelInfo]
    selected_model: Optional[str] = None
    auth_method: str


class SelectModelRequest(BaseModel):
    model: str


class SelectModelResponse(BaseModel):
    selected_model: str
    message: str


class DeviceCodeResponse(BaseModel):
    user_code: str
    verification_uri: str
    expires_in: int
    interval: int


# ============================================================================
# Endpoints
# ============================================================================


@router.post("/login", response_model=LoginResponse)
async def login():
    """Start the ChatGPT OAuth browser-based login flow."""
    oauth = get_oauth_service()

    if oauth.flow_in_progress:
        raise HTTPException(status_code=409, detail="Login flow already in progress")

    # Return immediately, the flow runs in the background
    # For the synchronous callback approach, we run it and return the result
    result = await oauth.start_login_flow()

    if result["status"] == "connected":
        return LoginResponse(
            status="connected",
            message="Authentication successful.",
            subscription_tier=result.get("subscription_tier"),
            user_email=result.get("user_email"),
        )
    elif result["status"] == "timeout":
        raise HTTPException(status_code=408, detail=result["message"])
    else:
        raise HTTPException(status_code=500, detail=result.get("message", "Login failed"))


@router.get("/status", response_model=StatusResponse)
async def get_status():
    """Get the current OAuth session status."""
    oauth = get_oauth_service()
    session_status = oauth.get_session_status()

    if oauth.flow_in_progress:
        return StatusResponse(status="connecting")

    return StatusResponse(
        status=session_status["status"],
        subscription_tier=session_status.get("subscription_tier"),
        user_email=session_status.get("user_email"),
        expires_at=session_status.get("expires_at"),
        needs_reauth=session_status.get("needs_reauth"),
    )


@router.post("/logout", response_model=LogoutResponse)
async def logout():
    """Sign out of ChatGPT OAuth and clear stored tokens."""
    oauth = get_oauth_service()
    result = oauth.logout()
    return LogoutResponse(**result)


@router.post("/device-code", response_model=DeviceCodeResponse)
async def start_device_code():
    """Start the device code authentication flow (for headless environments)."""
    oauth = get_oauth_service()

    if oauth.flow_in_progress:
        raise HTTPException(status_code=409, detail="Login flow already in progress")

    try:
        result = await oauth.start_device_code_flow()
        return DeviceCodeResponse(**result)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@router.put("/method", response_model=SwitchMethodResponse)
async def switch_auth_method(request: SwitchMethodRequest):
    """Switch between API Key and ChatGPT OAuth authentication methods."""
    if request.auth_method not in VALID_AUTH_METHODS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid auth_method. Must be one of: {', '.join(VALID_AUTH_METHODS)}",
        )

    oauth = get_oauth_service()
    session_status = oauth.get_session_status()

    if request.auth_method == "chatgpt_oauth":
        status = session_status["status"]
        if status == "not_connected":
            message = "Switched to ChatGPT OAuth. Please sign in."
        else:
            message = f"Switched to ChatGPT OAuth. Status: {status}."
    else:
        message = "Switched to API Key authentication."
        status = "connected"  # API key is always "connected" if set

    return SwitchMethodResponse(
        auth_method=request.auth_method,
        status=status,
        message=message,
    )


@router.get("/models", response_model=ModelsResponse)
async def get_models():
    """Get available models for the current authentication method.

    For ChatGPT OAuth, returns known Codex models (the OAuth token
    doesn't have access to api.openai.com/v1/models).
    """
    from mindflow.providers.openai_chatgpt import CHATGPT_MODELS, DEFAULT_MODEL

    oauth = get_oauth_service()
    token = await oauth.get_valid_token()

    if not token:
        return ModelsResponse(
            models=[],
            selected_model=None,
            auth_method="chatgpt_oauth",
        )

    # Return known ChatGPT/Codex models (OAuth tokens can't query /v1/models)
    models = [
        ModelInfo(id=m, name=m, available=True)
        for m in CHATGPT_MODELS
    ]

    return ModelsResponse(
        models=models,
        selected_model=DEFAULT_MODEL,
        auth_method="chatgpt_oauth",
    )


@router.put("/model", response_model=SelectModelResponse)
async def select_model(request: SelectModelRequest):
    """Select the preferred model."""
    if not request.model:
        raise HTTPException(status_code=400, detail="Model ID is required")

    return SelectModelResponse(
        selected_model=request.model,
        message="Model updated.",
    )


__all__ = ["router"]
