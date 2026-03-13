# API Contracts: ChatGPT OAuth Login

**Feature Branch**: `010-chatgpt-oauth-login`
**Date**: 2026-03-13

## New Backend Endpoints

### POST /api/auth/openai/login

Start the ChatGPT OAuth browser-based login flow.

**Request**: No body required.

**Response** (200):
```json
{
  "status": "browser_opened",
  "message": "Please complete authentication in your browser.",
  "timeout_seconds": 120
}
```

**Behavior**:
1. Generate PKCE code_verifier/code_challenge
2. Start temporary HTTP server on available localhost port
3. Open system browser to `https://auth.openai.com/oauth/authorize?...`
4. Wait for callback (max 120 seconds)
5. Exchange code for tokens
6. Store encrypted session
7. Return result via WebSocket or polling

**Errors**:
- `409 Conflict`: Login flow already in progress
- `500 Internal Server Error`: Failed to start local HTTP server

---

### POST /api/auth/openai/device-code

Start the device code authentication flow (for headless environments).

**Request**: No body required.

**Response** (200):
```json
{
  "user_code": "ABCD-1234",
  "verification_uri": "https://auth.openai.com/activate",
  "expires_in": 900,
  "interval": 5
}
```

**Behavior**:
1. Request device code from OpenAI
2. Return code and URI to frontend for display
3. Backend polls for completion in background

**Errors**:
- `409 Conflict`: Login flow already in progress
- `502 Bad Gateway`: OpenAI device code endpoint unreachable

---

### GET /api/auth/openai/status

Get the current authentication status for OpenAI ChatGPT OAuth.

**Response** (200):
```json
{
  "auth_method": "chatgpt_oauth",
  "status": "connected",
  "subscription_tier": "plus",
  "user_email": "user@example.com",
  "expires_at": "2026-03-13T20:00:00Z",
  "detected_models": ["gpt-4o", "gpt-5", "o4-mini"],
  "selected_model": "gpt-5"
}
```

**Status values**: `"not_connected"`, `"connecting"`, `"connected"`, `"session_expired"`, `"auth_error"`

When `auth_method` is `"api_key"`:
```json
{
  "auth_method": "api_key",
  "status": "connected",
  "has_api_key": true
}
```

---

### POST /api/auth/openai/logout

Sign out of ChatGPT OAuth and clear stored tokens.

**Request**: No body required.

**Response** (200):
```json
{
  "status": "signed_out",
  "message": "ChatGPT session cleared."
}
```

**Behavior**:
1. Delete encrypted session file
2. Clear any in-memory session state
3. Reset `auth_method` to `"api_key"` in config

---

### PUT /api/auth/openai/method

Switch between API Key and ChatGPT OAuth authentication methods.

**Request**:
```json
{
  "auth_method": "chatgpt_oauth"
}
```

**Response** (200):
```json
{
  "auth_method": "chatgpt_oauth",
  "status": "not_connected",
  "message": "Switched to ChatGPT OAuth. Please sign in."
}
```

**Validation**:
- `auth_method` must be `"api_key"` or `"chatgpt_oauth"`

**Errors**:
- `400 Bad Request`: Invalid auth_method value

---

### GET /api/auth/openai/models

Get the list of models available through the current authentication method.

**Response** (200):
```json
{
  "models": [
    { "id": "gpt-5", "name": "GPT-5", "available": true },
    { "id": "gpt-4o", "name": "GPT-4o", "available": true },
    { "id": "o4-mini", "name": "o4-mini", "available": true }
  ],
  "selected_model": "gpt-5",
  "auth_method": "chatgpt_oauth"
}
```

**Behavior**:
- For `chatgpt_oauth`: Query OpenAI Models API with Bearer token, filter to chat-capable models
- For `api_key`: Query OpenAI Models API with API key (or return configured model)

---

### PUT /api/auth/openai/model

Select the preferred model for the current authentication method.

**Request**:
```json
{
  "model": "gpt-5"
}
```

**Response** (200):
```json
{
  "selected_model": "gpt-5",
  "message": "Model updated."
}
```

**Errors**:
- `400 Bad Request`: Model not in detected_models list
- `401 Unauthorized`: No active authentication session

---

## WebSocket Events (for login flow progress)

### Channel: `/ws/auth/openai`

**Events sent to frontend**:

```json
{"event": "flow_started", "message": "Browser opened. Waiting for authentication..."}
{"event": "callback_received", "message": "Authentication callback received. Exchanging tokens..."}
{"event": "login_success", "data": {"subscription_tier": "plus", "user_email": "user@example.com", "detected_models": ["gpt-5", "gpt-4o"]}}
{"event": "login_error", "error": "Token exchange failed. Please try again."}
{"event": "login_timeout", "error": "Authentication timed out after 120 seconds."}
{"event": "device_code_authorized", "data": {"subscription_tier": "plus"}}
```

## Impact on Existing Endpoints

### Existing LLM operation endpoints (NO CHANGES to contract)

The following endpoints continue to work unchanged. The backend transparently selects the correct authentication method (API key or OAuth token) based on the active `auth_method` in provider config:

- `POST /api/llm-operations/graphs/{graph_id}/operations`
- `GET /api/llm-operations/{operation_id}/stream`
- `DELETE /api/llm-operations/{operation_id}`

The authentication method is resolved internally by the provider layer — frontend sends the same requests regardless of auth method.
