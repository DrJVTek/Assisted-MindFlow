# API Contract: Provider Registry

**Prefix**: `/api/providers`

## Endpoints

### POST /api/providers
Create a new provider registration.

**Request**:
```json
{
  "name": "My Claude",
  "type": "anthropic",
  "color": "#6B4FBB",
  "api_key": "sk-ant-...",
  "endpoint_url": null,
  "selected_model": null
}
```

**Response** (201):
```json
{
  "id": "uuid",
  "name": "My Claude",
  "type": "anthropic",
  "color": "#6B4FBB",
  "status": "connected",
  "selected_model": "claude-sonnet-4-20250514",
  "available_models": ["claude-sonnet-4-20250514", "claude-haiku-4-5-20251001"],
  "endpoint_url": null,
  "created_at": "2026-03-14T10:00:00Z"
}
```

**Errors**:
- 400: Invalid provider type or missing required fields
- 422: Validation failed (bad color format, empty name, etc.)
- 502: Provider unreachable / API key invalid

**Behavior**: Validates credentials by making a lightweight test call (e.g., list models). Stores credentials encrypted. Returns provider with status and discovered models.

---

### GET /api/providers
List all registered providers.

**Response** (200):
```json
{
  "providers": [
    {
      "id": "uuid",
      "name": "My Claude",
      "type": "anthropic",
      "color": "#6B4FBB",
      "status": "connected",
      "selected_model": "claude-sonnet-4-20250514",
      "available_models": ["claude-sonnet-4-20250514", "claude-haiku-4-5-20251001"],
      "endpoint_url": null,
      "created_at": "2026-03-14T10:00:00Z"
    }
  ]
}
```

Note: Credentials (api_key, oauth_token) are NEVER returned in responses.

---

### GET /api/providers/{provider_id}
Get a single provider's details.

**Response** (200): Same shape as individual provider in list.
**Errors**: 404 if not found.

---

### PUT /api/providers/{provider_id}
Update a provider (name, color, selected_model, credentials).

**Request** (partial update):
```json
{
  "name": "Work Claude",
  "color": "#8B5CF6",
  "selected_model": "claude-haiku-4-5-20251001",
  "api_key": "sk-ant-new-..."
}
```

**Response** (200): Updated provider object.
**Errors**: 404, 422, 502 (re-validates if credentials changed).

---

### DELETE /api/providers/{provider_id}
Remove a provider. Nodes using this provider become "provider disconnected".

**Response** (200):
```json
{
  "message": "Provider removed",
  "affected_nodes": 3
}
```

**Errors**: 404 if not found.

---

### POST /api/providers/{provider_id}/validate
Re-validate an existing provider's connection.

**Response** (200):
```json
{
  "status": "connected",
  "available_models": ["..."]
}
```

**Errors**: 502 if validation fails (status set to "error").

---

### GET /api/providers/{provider_id}/models
List available models for a provider.

**Response** (200):
```json
{
  "models": [
    { "id": "claude-sonnet-4-20250514", "name": "Claude Sonnet 4", "available": true },
    { "id": "claude-opus-4-20250514", "name": "Claude Opus 4", "available": true }
  ]
}
```
