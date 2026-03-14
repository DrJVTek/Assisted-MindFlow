"""DEPRECATED: Authentication API routes for ChatGPT OAuth.

These routes are deprecated in favor of the unified provider OAuth routes:
  POST /api/providers/{id}/oauth/login
  GET  /api/providers/{id}/oauth/status
  POST /api/providers/{id}/oauth/logout
  POST /api/providers/{id}/oauth/device-code

These wrappers delegate to the first CHATGPT_WEB provider for backward compatibility.
They will be removed in a future release.
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from mindflow.models.provider import AuthMethod, ProviderType

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth/openai", tags=["auth (deprecated)"])


def _find_chatgpt_provider_id() -> Optional[str]:
    """Find the first CHATGPT_WEB provider with OAuth auth."""
    from mindflow.api.routes.providers import _get_registry

    registry = _get_registry()
    for p in registry.list_providers():
        if p.type == ProviderType.CHATGPT_WEB and p.auth_method == AuthMethod.OAUTH:
            return str(p.id)
    return None


# ── Response Models (kept for backward compat) ──────────────────


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


# ── Deprecated Endpoints ────────────────────────────────────────


@router.post("/login", response_model=LoginResponse, deprecated=True)
async def login():
    """DEPRECATED: Use POST /api/providers/{id}/oauth/login instead."""
    logger.warning("Deprecated endpoint /auth/openai/login called")
    from mindflow.api.routes.providers import _get_registry

    pid = _find_chatgpt_provider_id()
    if not pid:
        raise HTTPException(status_code=404, detail="No ChatGPT provider registered. Create one first via POST /api/providers.")

    registry = _get_registry()
    result = await registry.start_oauth_login(pid)

    if result.get("status") == "connected":
        return LoginResponse(
            status="connected",
            message="Authentication successful.",
            subscription_tier=result.get("subscription_tier"),
            user_email=result.get("user_email"),
        )
    elif result.get("status") == "timeout":
        raise HTTPException(status_code=408, detail=result.get("message"))
    else:
        raise HTTPException(status_code=500, detail=result.get("message", "Login failed"))


@router.get("/status", response_model=StatusResponse, deprecated=True)
async def get_status():
    """DEPRECATED: Use GET /api/providers/{id}/oauth/status instead."""
    pid = _find_chatgpt_provider_id()
    if not pid:
        return StatusResponse(status="not_connected")

    from mindflow.api.routes.providers import _get_registry

    registry = _get_registry()
    session_status = registry.get_oauth_status(pid)

    return StatusResponse(
        status=session_status.get("status", "not_connected"),
        subscription_tier=session_status.get("subscription_tier"),
        user_email=session_status.get("user_email"),
        expires_at=session_status.get("expires_at"),
        needs_reauth=session_status.get("needs_reauth"),
    )


@router.post("/logout", response_model=LogoutResponse, deprecated=True)
async def logout():
    """DEPRECATED: Use POST /api/providers/{id}/oauth/logout instead."""
    logger.warning("Deprecated endpoint /auth/openai/logout called")
    pid = _find_chatgpt_provider_id()
    if not pid:
        return LogoutResponse(status="signed_out", message="No ChatGPT provider found.")

    from mindflow.api.routes.providers import _get_registry

    registry = _get_registry()
    result = registry.oauth_logout(pid)
    return LogoutResponse(**result)


@router.post("/device-code", response_model=DeviceCodeResponse, deprecated=True)
async def start_device_code():
    """DEPRECATED: Use POST /api/providers/{id}/oauth/device-code instead."""
    logger.warning("Deprecated endpoint /auth/openai/device-code called")
    pid = _find_chatgpt_provider_id()
    if not pid:
        raise HTTPException(status_code=404, detail="No ChatGPT provider registered.")

    from mindflow.api.routes.providers import _get_registry

    registry = _get_registry()
    try:
        result = await registry.start_device_code(pid)
        return DeviceCodeResponse(**result)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@router.put("/method", response_model=SwitchMethodResponse, deprecated=True)
async def switch_auth_method(request: SwitchMethodRequest):
    """DEPRECATED: Auth method is now set per-provider via auth_method field."""
    logger.warning("Deprecated endpoint /auth/openai/method called")
    return SwitchMethodResponse(
        auth_method=request.auth_method,
        status="ok",
        message="Deprecated. Use provider auth_method field instead.",
    )


@router.get("/models", response_model=ModelsResponse, deprecated=True)
async def get_models():
    """DEPRECATED: Use GET /api/providers/{id}/models instead."""
    return ModelsResponse(
        models=[
            ModelInfo(id="gpt-4o", name="gpt-4o"),
            ModelInfo(id="gpt-4o-mini", name="gpt-4o-mini"),
            ModelInfo(id="gpt-4-turbo", name="gpt-4-turbo"),
        ],
        selected_model="gpt-4o",
        auth_method="chatgpt_oauth",
    )


@router.put("/model", response_model=SelectModelResponse, deprecated=True)
async def select_model(request: SelectModelRequest):
    """DEPRECATED: Use PUT /api/providers/{id} with selected_model field instead."""
    return SelectModelResponse(
        selected_model=request.model,
        message="Deprecated. Use provider update endpoint instead.",
    )


__all__ = ["router"]
