"""Provider registry API routes.

Provides endpoints for managing LLM provider registrations:
- POST   /api/providers                       — Register a new provider
- GET    /api/providers                       — List all providers
- GET    /api/providers/{id}                  — Get a single provider
- PUT    /api/providers/{id}                  — Update a provider
- DELETE /api/providers/{id}                  — Remove a provider
- POST   /api/providers/{id}/validate         — Re-validate a provider
- GET    /api/providers/{id}/models           — List available models
- POST   /api/providers/{id}/oauth/login      — Start OAuth browser flow
- GET    /api/providers/{id}/oauth/status     — Get OAuth session status
- POST   /api/providers/{id}/oauth/logout     — Clear OAuth session
- POST   /api/providers/{id}/oauth/device-code — Start device code flow
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from mindflow.models.provider import (
    AuthMethod,
    CreateProviderRequest,
    ProviderConfig,
    ProviderStatus,
    ProviderType,
    UpdateProviderRequest,
)
from mindflow.services.provider_registry import ProviderRegistry

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/providers", tags=["providers"])

# Singleton registry
_registry: Optional[ProviderRegistry] = None


def _get_registry() -> ProviderRegistry:
    global _registry
    if _registry is None:
        _registry = ProviderRegistry()
    return _registry


# ── Response Models ──────────────────────────────────────────────


class ProviderResponse(BaseModel):
    """Provider config without credentials."""

    id: str
    name: str
    type: ProviderType
    auth_method: AuthMethod
    color: str
    status: ProviderStatus
    selected_model: Optional[str]
    available_models: list[str]
    endpoint_url: Optional[str]
    oauth_status: Optional[str] = None
    oauth_email: Optional[str] = None
    created_at: str
    updated_at: str


class ProviderListResponse(BaseModel):
    providers: list[ProviderResponse]


class DeleteProviderResponse(BaseModel):
    message: str
    affected_nodes: int


class ValidateResponse(BaseModel):
    status: ProviderStatus
    available_models: list[str]


class ModelInfo(BaseModel):
    id: str
    name: str
    available: bool


class ModelsResponse(BaseModel):
    models: list[ModelInfo]


# ── OAuth Response Models ────────────────────────────────────────


class OAuthLoginResponse(BaseModel):
    status: str
    message: Optional[str] = None
    user_email: Optional[str] = None
    subscription_tier: Optional[str] = None


class OAuthStatusResponse(BaseModel):
    status: str
    user_email: Optional[str] = None
    subscription_tier: Optional[str] = None
    expires_at: Optional[str] = None
    needs_reauth: Optional[bool] = None


class OAuthLogoutResponse(BaseModel):
    status: str
    message: str


class DeviceCodeResponse(BaseModel):
    user_code: str
    verification_uri: str
    expires_in: int
    interval: int


def _to_response(config: ProviderConfig) -> ProviderResponse:
    """Convert ProviderConfig to API response (no credentials)."""
    return ProviderResponse(
        id=str(config.id),
        name=config.name,
        type=config.type,
        auth_method=config.auth_method,
        color=config.color,
        status=config.status,
        selected_model=config.selected_model,
        available_models=config.available_models,
        endpoint_url=config.endpoint_url,
        oauth_status=config.oauth_status,
        oauth_email=config.oauth_email,
        created_at=config.created_at.isoformat(),
        updated_at=config.updated_at.isoformat(),
    )


# ── CRUD Endpoints ──────────────────────────────────────────────


@router.post("", response_model=ProviderResponse, status_code=201)
async def create_provider(request: CreateProviderRequest):
    """Register a new LLM provider instance."""
    registry = _get_registry()
    config = registry.register_provider(request)

    # Skip auto-validation for OAuth providers (must login first)
    if config.auth_method != AuthMethod.OAUTH:
        try:
            provider = registry.get_provider_instance(str(config.id))
            if provider:
                models = await _discover_models(config, provider)
                registry.set_available_models(str(config.id), models)
                if config.selected_model is None and models:
                    config.selected_model = models[0]
                registry.set_status(str(config.id), ProviderStatus.CONNECTED)
        except Exception as exc:
            logger.warning("Provider validation failed for %s: %s", config.id, exc)
            registry.set_status(str(config.id), ProviderStatus.ERROR)

    return _to_response(registry.get_provider(str(config.id)))


@router.get("", response_model=ProviderListResponse)
async def list_providers():
    """List all registered providers."""
    registry = _get_registry()
    providers = registry.list_providers()
    return ProviderListResponse(
        providers=[_to_response(p) for p in providers]
    )


@router.get("/{provider_id}", response_model=ProviderResponse)
async def get_provider(provider_id: str):
    """Get a single provider's details."""
    registry = _get_registry()
    config = registry.get_provider(provider_id)
    if config is None:
        raise HTTPException(status_code=404, detail="Provider not found")
    return _to_response(config)


@router.put("/{provider_id}", response_model=ProviderResponse)
async def update_provider(provider_id: str, request: UpdateProviderRequest):
    """Update an existing provider."""
    registry = _get_registry()
    config = registry.update_provider(provider_id, request)
    if config is None:
        raise HTTPException(status_code=404, detail="Provider not found")

    # Re-validate if credentials changed
    if request.api_key is not None or request.oauth_token is not None:
        try:
            provider = registry.get_provider_instance(provider_id)
            if provider:
                models = await _discover_models(config, provider)
                registry.set_available_models(provider_id, models)
                registry.set_status(provider_id, ProviderStatus.CONNECTED)
        except Exception as exc:
            logger.warning("Re-validation failed for %s: %s", provider_id, exc)
            registry.set_status(provider_id, ProviderStatus.ERROR)

    return _to_response(registry.get_provider(provider_id))


@router.delete("/{provider_id}", response_model=DeleteProviderResponse)
async def delete_provider(provider_id: str):
    """Remove a provider. Nodes using it become 'provider disconnected'."""
    registry = _get_registry()
    if not registry.delete_provider(provider_id):
        raise HTTPException(status_code=404, detail="Provider not found")

    return DeleteProviderResponse(message="Provider removed", affected_nodes=0)


@router.post("/{provider_id}/validate", response_model=ValidateResponse)
async def validate_provider(provider_id: str):
    """Re-validate an existing provider's connection."""
    registry = _get_registry()
    config = registry.get_provider(provider_id)
    if config is None:
        raise HTTPException(status_code=404, detail="Provider not found")

    provider = registry.get_provider_instance(provider_id)
    if provider is None:
        raise HTTPException(status_code=502, detail="Cannot create provider instance")

    try:
        models = await _discover_models(config, provider)
        registry.set_available_models(provider_id, models)
        registry.set_status(provider_id, ProviderStatus.CONNECTED)
        return ValidateResponse(
            status=ProviderStatus.CONNECTED,
            available_models=models,
        )
    except Exception as exc:
        registry.set_status(provider_id, ProviderStatus.ERROR)
        raise HTTPException(status_code=502, detail=f"Validation failed: {exc}")


@router.get("/{provider_id}/models", response_model=ModelsResponse)
async def get_provider_models(provider_id: str):
    """List available models for a provider."""
    registry = _get_registry()
    config = registry.get_provider(provider_id)
    if config is None:
        raise HTTPException(status_code=404, detail="Provider not found")

    return ModelsResponse(
        models=[
            ModelInfo(id=m, name=m, available=True)
            for m in config.available_models
        ]
    )


# ── OAuth Endpoints ──────────────────────────────────────────────


@router.post("/{provider_id}/oauth/login", response_model=OAuthLoginResponse)
async def oauth_login(provider_id: str):
    """Start OAuth browser login flow for a provider."""
    registry = _get_registry()
    config = registry.get_provider(provider_id)
    if config is None:
        raise HTTPException(status_code=404, detail="Provider not found")
    if config.auth_method != AuthMethod.OAUTH:
        raise HTTPException(status_code=400, detail="Provider does not use OAuth authentication")

    result = await registry.start_oauth_login(provider_id)

    if result.get("status") == "error":
        raise HTTPException(status_code=502, detail=result.get("message", "OAuth login failed"))

    return OAuthLoginResponse(**result)


@router.get("/{provider_id}/oauth/status", response_model=OAuthStatusResponse)
async def oauth_status(provider_id: str):
    """Get OAuth session status for a provider."""
    registry = _get_registry()
    config = registry.get_provider(provider_id)
    if config is None:
        raise HTTPException(status_code=404, detail="Provider not found")

    result = registry.get_oauth_status(provider_id)
    return OAuthStatusResponse(**result)


@router.post("/{provider_id}/oauth/logout", response_model=OAuthLogoutResponse)
async def oauth_logout(provider_id: str):
    """Clear OAuth session for a provider."""
    registry = _get_registry()
    config = registry.get_provider(provider_id)
    if config is None:
        raise HTTPException(status_code=404, detail="Provider not found")

    result = registry.oauth_logout(provider_id)
    return OAuthLogoutResponse(**result)


@router.post("/{provider_id}/oauth/device-code", response_model=DeviceCodeResponse)
async def oauth_device_code(provider_id: str):
    """Start device code flow for headless OAuth authentication."""
    registry = _get_registry()
    config = registry.get_provider(provider_id)
    if config is None:
        raise HTTPException(status_code=404, detail="Provider not found")
    if config.auth_method != AuthMethod.OAUTH:
        raise HTTPException(status_code=400, detail="Provider does not use OAuth authentication")

    try:
        result = await registry.start_device_code(provider_id)
        return DeviceCodeResponse(**result)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


# ── Helpers ──────────────────────────────────────────────────────


async def _discover_models(config: ProviderConfig, provider: object) -> list[str]:
    """Discover available models from a provider."""
    try:
        if config.type == ProviderType.OPENAI:
            from openai import AsyncOpenAI

            creds = _get_registry().get_credentials(str(config.id))
            client = AsyncOpenAI(
                api_key=creds.api_key if creds else None,
                base_url=config.endpoint_url,
            )
            models = await client.models.list()
            return sorted([m.id for m in models.data if "gpt" in m.id.lower()])

        if config.type == ProviderType.ANTHROPIC:
            return [
                "claude-opus-4-20250514",
                "claude-sonnet-4-20250514",
                "claude-haiku-4-5-20251001",
            ]

        if config.type == ProviderType.GEMINI:
            return ["gemini-2.0-flash", "gemini-2.5-pro", "gemini-2.5-flash"]

        if config.type == ProviderType.LOCAL:
            import httpx

            # Try Ollama API first, then OpenAI-compatible /v1/models
            endpoint = config.endpoint_url or "http://localhost:11434"
            async with httpx.AsyncClient(timeout=10.0) as client:
                try:
                    resp = await client.get(f"{endpoint}/api/tags")
                    resp.raise_for_status()
                    data = resp.json()
                    return [m["name"] for m in data.get("models", [])]
                except Exception:
                    # Fallback: OpenAI-compatible endpoint (LM Studio, vLLM, etc.)
                    resp = await client.get(f"{endpoint}/v1/models")
                    resp.raise_for_status()
                    data = resp.json()
                    return [m["id"] for m in data.get("data", [])]

        if config.type == ProviderType.CHATGPT_WEB:
            return ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"]

    except Exception as exc:
        logger.warning("Model discovery failed for %s (%s): %s", config.name, config.type, exc)
        raise

    return []
