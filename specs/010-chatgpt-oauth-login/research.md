# Research: ChatGPT OAuth Login

**Feature Branch**: `010-chatgpt-oauth-login`
**Date**: 2026-03-13

## R1: OpenAI Codex CLI OAuth Protocol

### Decision
Use the same OAuth 2.0 + PKCE flow as OpenAI Codex CLI, with the public client ID `app_EMoamEEZ73f0CkXaXp7hrann`.

### Rationale
This is the official, documented, and proven authentication method used by Codex CLI. Using the same client ID and endpoints ensures compatibility with OpenAI's infrastructure and benefits from the same access granted to ChatGPT subscription plans.

### Key Technical Details

**Endpoints:**
- Authorization: `https://auth.openai.com/oauth/authorize`
- Token: `https://auth.openai.com/oauth/token`
- Client ID: `app_EMoamEEZ73f0CkXaXp7hrann` (OpenAI Codex public client)

**PKCE Flow:**
1. Generate 32 random bytes → base64url encode → `code_verifier`
2. SHA256 hash of `code_verifier` → base64url encode → `code_challenge`
3. Start local HTTP server on `localhost:1455` (or available port)
4. Open browser to authorization endpoint with `code_challenge`, `redirect_uri=http://localhost:{port}/auth/callback`
5. User authenticates on OpenAI website
6. Browser redirects to `localhost:{port}/auth/callback?code=...`
7. Backend exchanges `code` + `code_verifier` for access/refresh tokens at token endpoint
8. Shut down local HTTP server

**Token Refresh:**
- Check token expiry before each API call
- If expiring within 5 minutes, auto-refresh using refresh token
- On 401 response, attempt one refresh before failing
- Persist refreshed tokens to encrypted file

### Alternatives Considered
- **Custom OAuth client registration**: Rejected — would require OpenAI approval and maintenance of a separate client. Using the Codex public client is simpler and officially supported.
- **Screen scraping ChatGPT web UI**: Rejected — fragile, against ToS, not maintainable.
- **opencode-openai-codex-auth library**: Could be used as reference but is Node.js-focused. We'll implement natively in Python for the backend.

### Sources
- [OpenAI Codex Authentication Docs](https://developers.openai.com/codex/auth/)
- [opencode-openai-codex-auth (GitHub)](https://github.com/numman-ali/opencode-openai-codex-auth)
- [Codex CLI OAuth source (Rust)](https://github.com/openai/codex/blob/main/codex-rs/login/src/server.rs)

---

## R2: Token Storage with Encryption

### Decision
Store tokens in an encrypted JSON file at `data/oauth/session.enc`, using Fernet symmetric encryption with a machine-derived key.

### Rationale
Fernet (from Python's `cryptography` library) provides authenticated encryption (AES-128-CBC + HMAC). The key is derived from a combination of machine-specific identifiers (hostname, OS user, a salt file) using PBKDF2. This matches the security level of Codex CLI's approach while staying within Python's ecosystem.

### Key Technical Details

**File structure** (decrypted content):
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "expires_at": "2026-03-13T20:00:00Z",
  "token_type": "Bearer",
  "subscription_tier": "plus",
  "user_email": "user@example.com"
}
```

**Encryption key derivation:**
1. Generate a random salt file on first use: `data/oauth/.salt` (32 bytes)
2. Derive key from: `PBKDF2(password=hostname+username, salt=salt_file, iterations=480000)`
3. Encrypt JSON with Fernet using derived key
4. Store encrypted blob in `data/oauth/session.enc`

### Alternatives Considered
- **OS keychain (keyring library)**: More secure but platform-dependent behavior, complex setup on Linux servers, unreliable in headless environments.
- **Plaintext JSON with file permissions**: Too insecure — any process with file read access gets the tokens.
- **Environment variables**: Don't persist across restarts; bad for OAuth tokens with refresh lifecycle.

---

## R3: Model Detection via API

### Decision
After OAuth authentication, query the OpenAI Models API (`GET /v1/models`) with the Bearer token to detect available models, then filter to chat-capable models.

### Rationale
This gives an accurate, real-time view of which models the user's subscription tier can access. Static lists would become outdated as OpenAI adds/removes models.

### Key Technical Details

- **Endpoint**: `GET https://api.openai.com/v1/models` with `Authorization: Bearer <oauth_token>`
- **Filter**: Only include models with `id` matching known chat-capable patterns (gpt-*, o1-*, etc.)
- **Cache**: Cache the model list for the session (refresh on sign-in or manual refresh)
- **Fallback**: If the models endpoint fails or returns empty, fall back to a sensible default list based on subscription tier

### Alternatives Considered
- **Hardcoded model list per tier**: Simpler but becomes stale as OpenAI updates model availability.
- **No model detection**: User selects manually — poor UX, error-prone.

---

## R4: Device Code Flow

### Decision
Implement RFC 8628 Device Authorization Grant as a fallback for headless environments.

### Rationale
Codex CLI supports this via `codex login --device-auth`. It's the standard approach for environments without browser access. OpenAI's auth endpoint supports device code grants.

### Key Technical Details

1. POST to `https://auth.openai.com/oauth/device/code` with `client_id`
2. Receive `device_code`, `user_code`, `verification_uri`, `interval`
3. Display to user: "Visit {verification_uri} and enter code: {user_code}"
4. Poll `https://auth.openai.com/oauth/token` with `grant_type=urn:ietf:params:oauth:grant-type:device_code` every `interval` seconds
5. Once authorized, receive access/refresh tokens

### Alternatives Considered
- **Copy-paste token from browser**: Poor UX, insecure (token in clipboard).
- **QR code only**: Not accessible in all terminal environments.

---

## R5: Integration with Existing Provider Architecture

### Decision
Create a new `OpenAIChatGPTProvider` class that extends the existing `LLMProvider` interface, wrapping the existing `OpenAIProvider` logic but using OAuth Bearer token authentication instead of API key.

### Rationale
The constitution mandates "LLM Provider Agnostic" (Principle II) and "New providers MUST be addable without modifying existing code". Creating a separate provider class keeps the existing API key flow untouched and follows the pluggable provider pattern.

### Key Technical Details

- `OpenAIChatGPTProvider` uses `AsyncOpenAI(api_key=<oauth_token>)` — the OpenAI Python SDK accepts Bearer tokens the same way as API keys.
- Token refresh is handled transparently: before each `generate()` or `stream()` call, check token expiry and refresh if needed.
- The provider registers as `"openai_chatgpt"` in the provider config, separate from `"openai"` (API key).
- Frontend SettingsPanel shows both under "OpenAI" with a radio toggle for auth method.

### Alternatives Considered
- **Modify existing OpenAIProvider**: Violates constitution Principle II (no modification of existing providers). Also adds complexity to a working component.
- **Middleware/interceptor pattern**: Overengineered for this use case — a separate provider is simpler and cleaner.
