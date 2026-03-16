# API Contract: LLM Provider Interface

**Purpose**: Defines the refactored provider management endpoints aligned with the two-layer architecture.

## Existing Endpoints (Refactored)

These endpoints already exist but are refactored to use the new LLM Provider Interface.

### POST /api/providers — Register Provider Instance

**Request**:
```json
{
  "name": "My OpenAI",
  "type": "openai",
  "credentials": {
    "api_key": "sk-..."
  },
  "config": {
    "endpoint_url": "https://api.openai.com/v1",
    "default_model": "gpt-4o"
  }
}
```

**Response (201 Created)**:
```json
{
  "id": "uuid",
  "name": "My OpenAI",
  "type": "openai",
  "status": "connected",
  "available_models": [
    {"id": "gpt-4o", "name": "GPT-4o", "context_length": 128000, "capabilities": ["streaming", "tools"]},
    {"id": "gpt-4o-mini", "name": "GPT-4o Mini", "context_length": 128000, "capabilities": ["streaming"]}
  ],
  "created_at": "2026-03-15T..."
}
```

**Error (400)**:
```json
{"detail": "Missing required credential: api_key"}
```

### GET /api/providers — List All Provider Instances

**Response (200)**:
```json
{
  "providers": [
    {
      "id": "uuid",
      "name": "My OpenAI",
      "type": "openai",
      "status": "connected",
      "selected_model": "gpt-4o",
      "available_models": [...],
      "auth_method": "api_key"
    }
  ]
}
```

### POST /api/providers/{id}/validate — Validate Provider Connection

Tests that the provider can connect with its current credentials.

**Response (200)**:
```json
{
  "valid": true,
  "status": "connected",
  "models_found": 15
}
```

**Response (200, invalid)**:
```json
{
  "valid": false,
  "status": "error",
  "error": "Authentication failed: Invalid API key"
}
```

### GET /api/providers/{id}/models — List Available Models

**Response (200)**:
```json
{
  "models": [
    {"id": "gpt-4o", "name": "GPT-4o", "context_length": 128000, "capabilities": ["streaming", "vision", "tools"]},
    {"id": "gpt-4o-mini", "name": "GPT-4o Mini", "context_length": 128000, "capabilities": ["streaming"]}
  ]
}
```

### GET /api/providers/{id}/status — Provider Status

**Response (200)**:
```json
{
  "status": "connected",
  "progress": null,
  "active_operations": 2,
  "queue_length": 0
}
```

### GET /api/providers/required-credentials/{type} — Required Credentials for Type

**New endpoint** — helps the frontend render the right credential inputs.

**Response (200)**:
```json
{
  "provider_type": "openai",
  "credentials": [
    {"key": "api_key", "label": "OpenAI API Key", "type": "api_key", "required": true}
  ],
  "optional_config": [
    {"key": "endpoint_url", "label": "Custom Endpoint", "type": "url", "required": false, "default": "https://api.openai.com/v1"}
  ]
}
```

## Provider Types & Auth Methods

| Type | Auth Method | Required Credentials |
|------|------------|---------------------|
| openai | api_key | api_key, (optional: endpoint_url) |
| anthropic | api_key | api_key |
| ollama | endpoint | endpoint_url (default: http://localhost:11434) |
| gemini | api_key | api_key |
| chatgpt_web | oauth | OAuth flow (via /oauth/login) |

## Notes

- Provider instances are independent — multiple OpenAI providers with different API keys are allowed
- Provider status is real-time from the LLM Provider Interface `get_status()` method
- Credentials are encrypted at rest via SecretStorage
- OAuth endpoints (/oauth/login, /oauth/status, /oauth/logout) remain unchanged
