# Quickstart: ChatGPT OAuth Login

**Feature Branch**: `010-chatgpt-oauth-login`

## What this feature does

Allows MindFlow users to authenticate with OpenAI using their ChatGPT Plus/Pro subscription (via OAuth) instead of requiring a separate API key. The authentication flow mirrors how OpenAI Codex CLI works.

## Key files to know

### Backend (Python)

| File | Purpose |
| ---- | ------- |
| `src/mindflow/providers/openai_chatgpt.py` | **New** — OAuth-authenticated OpenAI provider |
| `src/mindflow/services/oauth_service.py` | **New** — OAuth flow orchestration (PKCE, callback server, token management) |
| `src/mindflow/services/token_storage.py` | **New** — Encrypted token persistence |
| `src/mindflow/api/routes/auth.py` | **New** — Auth-related REST endpoints |
| `src/mindflow/providers/base.py` | Unchanged — existing LLMProvider interface |
| `src/mindflow/providers/openai.py` | Unchanged — existing API key provider |

### Frontend (TypeScript/React)

| File | Purpose |
| ---- | ------- |
| `frontend/src/components/SettingsPanel.tsx` | **Modified** — Add auth method toggle and OAuth status |
| `frontend/src/components/OAuthLoginButton.tsx` | **New** — Sign in/out button with status display |
| `frontend/src/components/ModelSelector.tsx` | **New** — Model dropdown populated from detected models |
| `frontend/src/stores/authStore.ts` | **New** — Zustand store for OAuth session state |
| `frontend/src/services/api.ts` | **Modified** — Add auth endpoints |

### Configuration

| File | Purpose |
| ---- | ------- |
| `config/config.json` | **Modified** — Add `auth_method` field to OpenAI provider config |
| `data/oauth/session.enc` | **New** (runtime) — Encrypted token file (git-ignored) |
| `data/oauth/.salt` | **New** (runtime) — Encryption salt (git-ignored) |

## Architecture overview

```
Frontend (SettingsPanel)
  │
  ├── Click "Sign in with ChatGPT"
  │   └── POST /api/auth/openai/login
  │       └── Backend starts PKCE OAuth flow
  │           ├── Opens browser → auth.openai.com
  │           ├── Temporary localhost server captures callback
  │           ├── Exchanges code for tokens
  │           ├── Encrypts & stores tokens
  │           └── WebSocket → frontend: "login_success"
  │
  ├── LLM generation (same as before)
  │   └── POST /api/llm-operations/graphs/{id}/operations
  │       └── Backend checks auth_method
  │           ├── "api_key" → existing OpenAIProvider
  │           └── "chatgpt_oauth" → new OpenAIChatGPTProvider
  │               └── Uses Bearer token (auto-refreshed)
  │
  └── Click "Sign out"
      └── POST /api/auth/openai/logout
          └── Deletes session.enc, resets to api_key
```

## How to test

1. Start backend and frontend (`restart.bat` or `restart.sh`)
2. Open Settings panel → OpenAI section
3. Select "Sign in with ChatGPT" → authenticate in browser
4. Verify "Connected (ChatGPT Plus)" status
5. Create a node → trigger LLM generation
6. Verify streaming response works
7. Switch to "API Key" → verify it still works
8. Sign out → verify "Not connected" status

## Dependencies added

- `cryptography` (Python) — for Fernet encryption of tokens
- No new frontend dependencies
