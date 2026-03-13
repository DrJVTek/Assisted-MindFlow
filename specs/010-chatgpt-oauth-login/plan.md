# Implementation Plan: ChatGPT OAuth Login

**Branch**: `010-chatgpt-oauth-login` | **Date**: 2026-03-13 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/010-chatgpt-oauth-login/spec.md`

## Summary

Enable MindFlow users to authenticate with OpenAI via their ChatGPT subscription using the same OAuth 2.0 + PKCE flow as Codex CLI. This adds a new `OpenAIChatGPTProvider` that uses Bearer token authentication (auto-refreshed) alongside the existing API key provider. Tokens are stored in an encrypted file on the backend. The frontend settings panel gains an auth method toggle, OAuth login/logout buttons, status display, and a model selector populated from the detected models.

## Technical Context

**Language/Version**: Python 3.11 (backend), TypeScript 5.9 (frontend)
**Primary Dependencies**: FastAPI, AsyncOpenAI, cryptography (Fernet), React 19, Zustand, ReactFlow
**Storage**: Encrypted JSON file (`data/oauth/session.enc`) for tokens, `config/config.json` for auth method preference
**Testing**: pytest (backend), vitest + @testing-library/react (frontend)
**Target Platform**: Windows + Linux (multiplatform, per Constitution Principle VI)
**Project Type**: Web application (backend + frontend)
**Performance Goals**: OAuth flow completion in <60s (SC-001), token refresh transparent to user (SC-002)
**Constraints**: Tokens must never appear in logs or frontend state (SC-005). Existing LLM features must work identically (SC-004).
**Scale/Scope**: Single-user local application, one OAuth session at a time

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
| --------- | ------ | ----- |
| I. Graph Integrity | PASS | No graph changes — this feature only affects authentication |
| II. LLM Provider Agnostic | PASS | New provider (`openai_chatgpt`) added without modifying existing providers. Follows pluggable interface. |
| III. Explicit Operations, No Magic | PASS | User explicitly chooses auth method. OAuth flow requires user action (browser login). |
| IV. Test-First for Graph Operations | PASS | No graph operation changes. Tests planned for OAuth service and provider. |
| V. Context Transparency | PASS | No changes to context building or display. |
| VI. Multiplatform Support | PASS | Python `webbrowser.open()` + localhost HTTP server work on Windows and Linux. PKCE crypto uses standard `cryptography` library. |
| VII. No Simulation or Hardcoded Data | PASS | Real OAuth flow, no mocks in production. Config-driven paths. |
| Security & Privacy | PASS | Tokens encrypted at rest (Fernet). Never logged or exposed to frontend. `data/oauth/` git-ignored. |
| Performance Standards | PASS | OAuth flow is user-initiated, not in hot path. Token refresh adds <100ms per API call. |

**Post-Phase 1 Re-check**: All gates still pass. The `OpenAIChatGPTProvider` follows the `LLMProvider` interface without modifying existing providers. Token storage is encrypted and git-ignored.

## Project Structure

### Documentation (this feature)

```text
specs/010-chatgpt-oauth-login/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0: OAuth protocol research
├── data-model.md        # Phase 1: Entity definitions
├── quickstart.md        # Phase 1: Developer guide
├── contracts/           # Phase 1: API contracts
│   └── oauth-api.md     # REST + WebSocket endpoints
├── checklists/          # Quality checklists
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
# Backend (Python)
src/mindflow/
├── providers/
│   ├── base.py                  # Existing — LLMProvider interface (unchanged)
│   ├── openai.py                # Existing — API key provider (unchanged)
│   ├── anthropic.py             # Existing — unchanged
│   ├── ollama.py                # Existing — unchanged
│   └── openai_chatgpt.py        # NEW — OAuth-authenticated OpenAI provider
├── services/
│   ├── oauth_service.py         # NEW — OAuth flow orchestration (PKCE, callback, tokens)
│   └── token_storage.py         # NEW — Encrypted token persistence (Fernet)
└── api/
    └── routes/
        └── auth.py              # NEW — /api/auth/openai/* endpoints

# Frontend (TypeScript/React)
frontend/src/
├── components/
│   ├── SettingsPanel.tsx         # MODIFIED — Add auth method section
│   ├── OAuthLoginButton.tsx      # NEW — Sign in/out with status
│   └── ModelSelector.tsx         # NEW — Model dropdown
├── stores/
│   └── authStore.ts             # NEW — OAuth session state (Zustand)
└── services/
    └── api.ts                   # MODIFIED — Add auth endpoints

# Tests
tests/
├── unit/
│   ├── test_oauth_service.py    # NEW — PKCE, token refresh, flow management
│   └── test_token_storage.py    # NEW — Encryption/decryption, key derivation
├── integration/
│   └── test_openai_chatgpt_provider.py  # NEW — Provider with mocked OAuth
└── contract/
    └── test_auth_endpoints.py   # NEW — Auth API contract tests

frontend/tests/
└── unit/
    ├── OAuthLoginButton.test.tsx  # NEW
    ├── ModelSelector.test.tsx     # NEW
    └── authStore.test.ts          # NEW

# Configuration & Data
config/config.json               # MODIFIED — Add auth_method field
data/oauth/                      # NEW (runtime, git-ignored)
├── session.enc                  # Encrypted token file
└── .salt                        # Encryption salt
.gitignore                       # MODIFIED — Add data/oauth/
```

**Structure Decision**: Web application structure (backend + frontend), consistent with existing project layout. New files added to existing directories following established patterns. No new top-level directories.

## Complexity Tracking

No constitution violations to justify. Feature follows existing patterns cleanly.
