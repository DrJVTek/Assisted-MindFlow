# Tasks: ChatGPT OAuth Login

**Input**: Design documents from `/specs/010-chatgpt-oauth-login/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/oauth-api.md

**Tests**: Tests included per Constitution Principle IV (Test-First for Graph Operations) and project testing requirements (80% coverage target).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add dependencies, configure project for OAuth feature

- [ ] T001 Add `cryptography` dependency to `pyproject.toml` and `requirements.txt`
- [ ] T002 Add `data/oauth/` directory to `.gitignore` (session.enc, .salt files must never be committed)
- [ ] T003 [P] Create `data/oauth/` directory with `.gitkeep` to ensure directory exists in repo

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core OAuth infrastructure that MUST be complete before ANY user story can begin

**CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 [P] Create OAuthSession Pydantic model in `src/mindflow/models/oauth_session.py` — fields: access_token, refresh_token, expires_at, token_type, subscription_tier, user_email, created_at, last_refreshed_at (per data-model.md)
- [ ] T005 [P] Implement encrypted token storage service in `src/mindflow/services/token_storage.py` — Fernet encryption with machine-derived key (PBKDF2 from hostname+username+salt), load/save/delete session from `data/oauth/session.enc`, generate salt file on first use (per research.md R2)
- [ ] T006 [P] Write unit tests for token_storage in `tests/unit/test_token_storage.py` — test encrypt/decrypt round-trip, test salt generation, test missing file handling, test corrupted file handling
- [ ] T007 Implement OAuth service core in `src/mindflow/services/oauth_service.py` — PKCE code_verifier/code_challenge generation, state parameter generation, OAuth URL construction with client_id `app_EMoamEEZ73f0CkXaXp7hrann` and endpoints from research.md R1
- [ ] T008 [P] Write unit tests for oauth_service PKCE logic in `tests/unit/test_oauth_service.py` — test code_verifier length and format, test code_challenge is SHA256 of verifier, test state randomness, test OAuth URL construction

**Checkpoint**: Foundation ready — OAuth crypto, storage, and PKCE infrastructure are tested and working

---

## Phase 3: User Story 1 — Sign in with ChatGPT (Priority: P1) MVP

**Goal**: User clicks "Sign in with ChatGPT", authenticates in browser, MindFlow receives token and can generate LLM responses using their ChatGPT subscription.

**Independent Test**: Click Sign in button → complete browser auth → create a node → trigger LLM generation → see streamed response.

### Implementation for User Story 1

- [ ] T009 [US1] Implement temporary HTTP callback server in `src/mindflow/services/oauth_service.py` — start on available localhost port, listen for `/auth/callback?code=...`, exchange code+code_verifier for tokens at `https://auth.openai.com/oauth/token`, store encrypted session, shut down server (per research.md R1, contracts/oauth-api.md)
- [ ] T010 [US1] Implement browser launch in `src/mindflow/services/oauth_service.py` — use `webbrowser.open()` to open authorization URL, handle timeout (120s), handle cancellation
- [ ] T011 [US1] Create OpenAIChatGPTProvider in `src/mindflow/providers/openai_chatgpt.py` — extends LLMProvider, uses `AsyncOpenAI(api_key=<oauth_token>)`, implements `generate()` and `stream()` matching existing OpenAIProvider pattern, checks token expiry before each call (per research.md R5)
- [ ] T012 [P] [US1] Write unit tests for OpenAIChatGPTProvider in `tests/unit/test_openai_chatgpt_provider.py` — test provider initialization with token, test token expiry check, test generate/stream delegation (mock AsyncOpenAI)
- [ ] T013 [US1] Create auth API routes in `src/mindflow/api/routes/auth.py` — POST `/api/auth/openai/login` (starts OAuth flow), GET `/api/auth/openai/status` (returns session status), POST `/api/auth/openai/logout` (clears session) per contracts/oauth-api.md
- [ ] T014 [US1] Register auth routes in `src/mindflow/api/server.py` — import and include auth router with `/api/auth` prefix
- [ ] T015 [P] [US1] Write contract tests for auth endpoints in `tests/contract/test_auth_endpoints.py` — test login returns 200 with status, test status returns session info or not_connected, test logout clears session
- [ ] T016 [P] [US1] Create authStore in `frontend/src/stores/authStore.ts` — Zustand store with state: authMethod, status, subscriptionTier, userEmail, detectedModels, selectedModel. Actions: login, logout, fetchStatus, setAuthMethod
- [ ] T017 [P] [US1] Add auth API methods to `frontend/src/services/api.ts` — login(), getAuthStatus(), logout(), switchAuthMethod(), getModels(), setModel() per contracts/oauth-api.md
- [ ] T018 [US1] Create OAuthLoginButton component in `frontend/src/components/OAuthLoginButton.tsx` — shows "Sign in with ChatGPT" button when not connected, shows "Connected (ChatGPT Plus) — user@email" with Sign out button when connected, shows "Connecting..." spinner during flow, shows "Session expired — Sign in again" when expired
- [ ] T019 [P] [US1] Write unit tests for OAuthLoginButton in `frontend/tests/unit/OAuthLoginButton.test.tsx` — test renders sign-in button when not connected, test renders connected state, test renders expired state, test click triggers login
- [ ] T020 [US1] Integrate OAuthLoginButton into `frontend/src/components/SettingsPanel.tsx` — add "OpenAI Authentication" section with the login button and status display

**Checkpoint**: User Story 1 complete — users can sign in via ChatGPT OAuth and use OpenAI models for LLM generation

---

## Phase 4: User Story 2 — Choose between API Key and ChatGPT Login (Priority: P1)

**Goal**: Settings panel shows both auth options (API Key and ChatGPT OAuth) with clear toggle. User can switch between methods seamlessly.

**Independent Test**: Open settings → see both auth options → switch from API Key to ChatGPT OAuth → verify LLM works → switch back → verify LLM still works.

### Implementation for User Story 2

- [ ] T021 [US2] Extend provider config in `config/config.example.json` — add `auth_method` field ("api_key" or "chatgpt_oauth") under OpenAI provider section, add `oauth_session_file` and `selected_model` fields (per data-model.md ProviderConfig)
- [ ] T022 [US2] Implement PUT `/api/auth/openai/method` endpoint in `src/mindflow/api/routes/auth.py` — validates auth_method value, updates config, returns new status (per contracts/oauth-api.md)
- [ ] T023 [US2] Update LLM operation creation in `src/mindflow/api/routes/llm_operations.py` — check `auth_method` in provider config, instantiate `OpenAIChatGPTProvider` when "chatgpt_oauth" selected, use existing `OpenAIProvider` when "api_key" selected
- [ ] T024 [US2] Implement GET `/api/auth/openai/models` endpoint in `src/mindflow/api/routes/auth.py` — query OpenAI Models API with current token (OAuth or API key), filter to chat-capable models, return list with availability flags (per research.md R3)
- [ ] T025 [P] [US2] Implement PUT `/api/auth/openai/model` endpoint in `src/mindflow/api/routes/auth.py` — validate model is in detected list, save selection to config
- [ ] T026 [P] [US2] Create ModelSelector component in `frontend/src/components/ModelSelector.tsx` — dropdown populated from detected models, shows selected model, triggers model change API on selection
- [ ] T027 [P] [US2] Write unit tests for ModelSelector in `frontend/tests/unit/ModelSelector.test.tsx` — test renders model list, test selection triggers callback, test empty state
- [ ] T028 [US2] Add auth method toggle to `frontend/src/components/SettingsPanel.tsx` — radio group "API Key" / "Sign in with ChatGPT" under OpenAI section, integrate ModelSelector below the toggle, show appropriate UI for each method (API key input vs OAuth login button)

**Checkpoint**: User Story 2 complete — users can switch between API Key and ChatGPT OAuth freely, with model selection working for both methods

---

## Phase 5: User Story 3 — Token Refresh and Session Management (Priority: P2)

**Goal**: Expired tokens are refreshed automatically. When refresh fails, user sees a clear message and can re-authenticate seamlessly.

**Independent Test**: Wait for token expiry (or manually expire stored token) → trigger LLM operation → verify auto-refresh works or re-auth prompt appears.

### Implementation for User Story 3

- [ ] T029 [US3] Implement token auto-refresh in `src/mindflow/services/oauth_service.py` — check expiry 5 minutes before, POST to token endpoint with grant_type=refresh_token, update encrypted session file, return new access token (per research.md R1)
- [ ] T030 [US3] Add refresh-on-401 recovery in `src/mindflow/providers/openai_chatgpt.py` — catch 401 responses from OpenAI, attempt one token refresh, retry the request, fail with clear error if refresh also fails
- [ ] T031 [P] [US3] Write unit tests for token refresh in `tests/unit/test_oauth_service.py` — test refresh when token near expiry, test refresh with invalid refresh token, test 401 recovery flow
- [ ] T032 [US3] Add session expired status to GET `/api/auth/openai/status` in `src/mindflow/api/routes/auth.py` — return "session_expired" when token is expired and refresh failed, include "needs_reauth" flag
- [ ] T033 [US3] Add frontend expired state handling in `frontend/src/stores/authStore.ts` — poll status periodically (every 60s when active), detect "session_expired" status, trigger notification
- [ ] T034 [US3] Add re-auth notification in `frontend/src/components/OAuthLoginButton.tsx` — show "Session expired. Sign in again." banner with one-click re-auth button, on successful re-auth resume pending state

**Checkpoint**: User Story 3 complete — token lifecycle is fully managed, users experience seamless session continuity

---

## Phase 6: User Story 4 — Device Code Authentication (Priority: P3)

**Goal**: Users in headless environments can authenticate via device code flow (enter a code on any browser).

**Independent Test**: Select "Device Code" option → see displayed URL and code → enter code on another device → verify "Connected" status.

### Implementation for User Story 4

- [ ] T035 [US4] Implement device code flow in `src/mindflow/services/oauth_service.py` — POST to `https://auth.openai.com/oauth/device/code`, return user_code and verification_uri, poll token endpoint at specified interval until authorized (per research.md R4)
- [ ] T036 [US4] Add POST `/api/auth/openai/device-code` endpoint in `src/mindflow/api/routes/auth.py` — start device code flow, return user_code/verification_uri/expires_in to frontend, background polling for completion (per contracts/oauth-api.md)
- [ ] T037 [P] [US4] Write unit tests for device code flow in `tests/unit/test_oauth_service.py` — test device code request, test polling logic, test timeout handling
- [ ] T038 [US4] Add device code UI to `frontend/src/components/OAuthLoginButton.tsx` — show "Use Device Code" link below sign-in button, display code and URL when flow active, show polling status ("Waiting for authorization..."), show success when authorized

**Checkpoint**: User Story 4 complete — headless environments can authenticate via device code

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Security hardening, documentation, and cross-story improvements

- [ ] T039 [P] Add WebSocket support for real-time login flow progress in `src/mindflow/api/routes/auth.py` — emit events: flow_started, callback_received, login_success, login_error, login_timeout (per contracts/oauth-api.md WebSocket Events)
- [ ] T040 [P] Security hardening in `src/mindflow/services/oauth_service.py` — validate token format before storage, sanitize all log messages to never include tokens or secrets, add rate limiting to auth endpoints
- [ ] T041 [P] Update `config/config.example.json` with new `auth_method`, `oauth_session_file`, and `selected_model` fields with documentation comments
- [ ] T042 Handle subscription-level errors in `src/mindflow/providers/openai_chatgpt.py` — detect rate limit (429), tier restriction (403), and subscription errors, return user-friendly messages per FR-010
- [ ] T043 Run quickstart.md end-to-end validation — start servers, sign in via ChatGPT, create node, generate LLM response, switch to API key, verify, sign out

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational (Phase 2) — MVP target
- **User Story 2 (Phase 4)**: Depends on User Story 1 (uses login infrastructure)
- **User Story 3 (Phase 5)**: Depends on User Story 1 (extends token management)
- **User Story 4 (Phase 6)**: Depends on Foundational (Phase 2) only — can be built in parallel with US2/US3
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

```
Phase 1 (Setup)
    └── Phase 2 (Foundational: PKCE, token storage, OAuthSession model)
         ├── Phase 3 (US1: Sign in with ChatGPT) ← MVP
         │    ├── Phase 4 (US2: Auth method toggle + model selector)
         │    └── Phase 5 (US3: Token refresh + session management)
         └── Phase 6 (US4: Device code flow) ← independent from US1
              └── Phase 7 (Polish)
```

### Within Each User Story

- Models/entities before services
- Services before API endpoints
- Backend endpoints before frontend components
- Tests can be written in parallel with their target file ([P] marked)
- Story complete before moving to next priority

### Parallel Opportunities

**Phase 2 (Foundational):**
```
T004 (OAuthSession model) ‖ T005 (token_storage) ‖ T006 (token_storage tests)
T007 (oauth_service core) depends on T004
T008 (oauth_service tests) ‖ T007 (after T004)
```

**Phase 3 (US1):**
```
T012 (provider tests) ‖ T015 (contract tests) ‖ T016 (authStore) ‖ T017 (api.ts) ‖ T019 (button tests)
T009 (callback server) → T010 (browser launch) → T011 (provider)
T013 (auth routes) → T014 (register in server.py)
T18 (OAuthLoginButton) → T020 (SettingsPanel integration)
```

**Phase 4 (US2):**
```
T025 (model endpoint) ‖ T026 (ModelSelector) ‖ T027 (ModelSelector tests)
T021 (config) → T022 (method endpoint) → T023 (LLM operation routing)
T24 (models endpoint) → T26 (ModelSelector) → T28 (SettingsPanel integration)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T008)
3. Complete Phase 3: User Story 1 (T009-T020)
4. **STOP and VALIDATE**: Sign in via ChatGPT → generate LLM response on a node
5. This delivers the core value: ChatGPT subscription → MindFlow AI features

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. User Story 1 → Test independently → **MVP delivered!**
3. User Story 2 → Test independently → Users can switch auth methods
4. User Story 3 → Test independently → Seamless session management
5. User Story 4 → Test independently → Headless environment support
6. Polish → Security hardening, real-time events, documentation

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- The OpenAI Python SDK accepts Bearer tokens the same way as API keys — this simplifies the provider implementation significantly
