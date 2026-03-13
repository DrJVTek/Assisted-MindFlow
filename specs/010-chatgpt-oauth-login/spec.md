# Feature Specification: ChatGPT OAuth Login

**Feature Branch**: `010-chatgpt-oauth-login`
**Created**: 2026-03-13
**Status**: Draft
**Input**: User description: "Ajouter la possibilité de se connecter à OpenAI via un compte ChatGPT Plus ($20/mois) au lieu de passer par l'API OpenAI classique (avec API key). Comme le fait Codex d'OpenAI, permettre d'utiliser les modèles via l'abonnement ChatGPT plutôt que via des crédits API séparés."

## Context

OpenAI's Codex CLI allows users to authenticate via their ChatGPT subscription ("Sign in with ChatGPT") instead of requiring a separate API key and billing. This uses an OAuth-based browser authentication flow that returns an access token. MindFlow should support the same mechanism so that users with a ChatGPT Plus ($20/month), Pro, Business, or Enterprise subscription can use OpenAI models without managing API keys or paying for separate API credits.

### Assumptions

- OpenAI's OAuth endpoint and token format used by Codex CLI are stable and available for third-party use. If OpenAI restricts this flow, an alternative approach using the open-source `opencode-openai-codex-auth` library or similar will be required.
- The ChatGPT OAuth token can be used with the same Chat Completions API endpoint that MindFlow currently uses with API keys.
- Token refresh is available via standard OAuth refresh token flow.
- The user's system has a browser available for the primary OAuth flow (device code flow covers headless cases).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign in with ChatGPT (Priority: P1)

A user with a ChatGPT Plus/Pro subscription wants to use OpenAI models in MindFlow without creating a separate API billing account or managing API keys. They click "Sign in with ChatGPT" in the settings panel, authenticate via their browser, and MindFlow automatically gains access to OpenAI models through their existing subscription.

**Why this priority**: This is the core value proposition — eliminating the friction of API key management and separate billing. Most target users already have a ChatGPT subscription but not an API account. Without this, the entire feature has no value.

**Independent Test**: Can be fully tested by clicking the Sign in button, completing browser authentication, and verifying that LLM generation works on a node using the ChatGPT subscription token.

**Acceptance Scenarios**:

1. **Given** a user with a ChatGPT Plus subscription who has not connected their account, **When** they click "Sign in with ChatGPT" in the LLM provider settings, **Then** a browser window opens to the OpenAI authentication page, the user logs in, and MindFlow receives and stores an access token.
2. **Given** a user who has completed the ChatGPT OAuth flow, **When** they create a node and trigger LLM generation, **Then** the system uses the ChatGPT subscription token to call OpenAI models and displays the streamed response.
3. **Given** a user who has completed the ChatGPT OAuth flow, **When** they return to MindFlow later (within the token's validity period), **Then** they are still authenticated without needing to sign in again.

---

### User Story 2 - Choose between API Key and ChatGPT Login (Priority: P1)

A user wants flexibility in how they connect to OpenAI. The settings panel offers two clear options: "API Key" (existing method) and "Sign in with ChatGPT" (new method). The user can switch between methods at any time.

**Why this priority**: Users need to understand and choose their authentication method. Some may prefer API keys (for higher rate limits, predictable billing), others prefer ChatGPT subscription (simpler, no extra cost). Both must coexist.

**Independent Test**: Can be tested by switching between API Key and ChatGPT login in settings and verifying that LLM operations work with each method.

**Acceptance Scenarios**:

1. **Given** the LLM provider settings panel, **When** the user views OpenAI configuration, **Then** they see two authentication options: "API Key" and "Sign in with ChatGPT", with clear descriptions of each.
2. **Given** a user currently authenticated via API Key, **When** they switch to "Sign in with ChatGPT" and complete the flow, **Then** all subsequent OpenAI requests use the ChatGPT subscription token instead of the API key.
3. **Given** a user currently authenticated via ChatGPT OAuth, **When** they switch to "API Key" and enter a valid key, **Then** all subsequent OpenAI requests use the API key instead of the OAuth token.

---

### User Story 3 - Token Refresh and Session Management (Priority: P2)

A user's ChatGPT OAuth token has expired. When they attempt an LLM operation, MindFlow automatically attempts to refresh the token. If the refresh fails, the user sees a clear message asking them to sign in again via their browser.

**Why this priority**: Token lifecycle management is essential for a smooth experience, but it's a secondary concern — the initial sign-in flow (US1) must work first.

**Independent Test**: Can be tested by waiting for token expiry (or manually invalidating the stored token) and verifying that the system either refreshes silently or prompts re-authentication.

**Acceptance Scenarios**:

1. **Given** a user with an expired ChatGPT OAuth token, **When** they trigger an LLM operation, **Then** the system automatically attempts to refresh the token without user intervention.
2. **Given** a user whose token refresh fails, **When** the system cannot obtain a new token, **Then** the user sees a notification: "Your ChatGPT session has expired. Please sign in again." with a direct "Sign in" button.
3. **Given** a user who is prompted to re-authenticate, **When** they complete the browser sign-in flow, **Then** the pending LLM operation resumes automatically.

---

### User Story 4 - Device Code Authentication (Priority: P3)

A user is running MindFlow on a system where opening a browser automatically is not practical (remote server, WSL, headless environment). They can use a "device code" authentication flow: MindFlow displays a URL and a code, the user opens the URL on any device, enters the code, and authenticates.

**Why this priority**: This is an alternative authentication path for edge cases. The primary browser-based flow (US1) covers the majority of users. Device code is a nice-to-have for advanced setups.

**Independent Test**: Can be tested by selecting "Device Code" authentication, verifying the displayed URL and code, completing authentication on a separate device, and confirming MindFlow receives the token.

**Acceptance Scenarios**:

1. **Given** a user who selects "Device Code" authentication, **When** the flow starts, **Then** MindFlow displays a URL and a one-time code, and instructions to visit the URL on any browser.
2. **Given** a user who has entered the device code on the OpenAI website, **When** they complete authentication, **Then** MindFlow receives the access token and shows a "Connected" status.

---

### Edge Cases

- What happens when the user's ChatGPT subscription expires or is downgraded? The system should detect the authorization error, notify the user clearly, and suggest either renewing their subscription or switching to API key authentication.
- What happens if the browser-based OAuth flow is blocked by a popup blocker? The system should detect the failure and offer the device code flow as a fallback, with clear instructions.
- What happens if the user has both an API key and ChatGPT OAuth configured? The system uses the actively selected method only, never both simultaneously.
- What happens during concurrent LLM operations when the token expires mid-stream? Ongoing streams should complete if possible; queued operations should wait for re-authentication.
- What happens if the user cancels the browser authentication flow? MindFlow should detect the cancellation (timeout or callback absence) and return to the previous state without errors.
- What happens if the OAuth endpoint is temporarily unavailable? The system should show a clear error and allow the user to retry, without losing their current work.

## Clarifications

### Session 2026-03-13

- Q: Where and how should OAuth tokens be stored? → A: Encrypted file on backend (similar to Codex CLI's `~/.codex/` storage), with a machine-derived encryption key. Tokens persist across server restarts but are not accessible to frontend JavaScript or stored in plaintext.
- Q: How does the browser deliver the OAuth token back to MindFlow? → A: Backend starts a temporary HTTP server on a local port, browser redirects to it after authentication, server captures the token and shuts down.
- Q: How are available models determined after OAuth sign-in? → A: Auto-detect by querying OpenAI API with the token, but also provide a model selector in the settings panel (consistent with other providers) so the user can choose their preferred model.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST offer an OAuth-based "Sign in with ChatGPT" authentication flow for OpenAI, using the same protocol as OpenAI Codex CLI. The backend starts a temporary local HTTP server to receive the OAuth callback from the browser, captures the token, and shuts down the temporary server.
- **FR-002**: System MUST support the existing API Key authentication method for OpenAI alongside the new OAuth method — both must coexist without conflicts.
- **FR-003**: System MUST store the OAuth access token and refresh token in an encrypted file on the backend (similar to Codex CLI's `~/.codex/` approach), using a machine-derived encryption key. Tokens must never be stored in plaintext, exposed in frontend state, or logged.
- **FR-004**: System MUST automatically refresh expired OAuth tokens using the refresh token, without requiring user interaction.
- **FR-005**: System MUST display a clear authentication status for the ChatGPT connection: "Not connected", "Connecting...", "Connected (ChatGPT Plus)", or "Session expired".
- **FR-006**: System MUST provide a "Sign out" action that clears all stored tokens and session data.
- **FR-007**: System MUST provide a device code authentication flow as an alternative when browser-based OAuth is unavailable or fails.
- **FR-008**: System MUST use the ChatGPT OAuth token to call OpenAI Chat Completions endpoints for both `generate` and `stream` operations, transparently to the rest of the application.
- **FR-009**: System MUST auto-detect available models by querying the OpenAI API with the OAuth token after sign-in, and display them in a model selector within the settings panel (consistent with the existing UI for other LLM providers). The user can select their preferred model from the detected list.
- **FR-010**: System MUST handle subscription-level errors (rate limits, tier restrictions) with user-friendly messages explaining the limitation and suggesting alternatives.

### Key Entities

- **AuthMethod**: Represents the authentication strategy for a given LLM provider. Has a type ("api_key" or "chatgpt_oauth"), an active flag, and associated credentials.
- **OAuthSession**: Represents an active ChatGPT OAuth session. Contains: access token, refresh token, expiry timestamp, subscription tier (Plus/Pro/Enterprise), and user identifier.
- **ProviderConfig**: Extended from current configuration to include the selected auth method and OAuth session state alongside existing API key fields.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can complete the full "Sign in with ChatGPT" flow and receive their first LLM response in under 60 seconds (from clicking the button to seeing a generated response on a node).
- **SC-002**: Token refresh succeeds silently (without user intervention) in 95%+ of cases when the refresh token is still valid.
- **SC-003**: Switching between API Key and ChatGPT OAuth authentication takes fewer than 3 clicks and under 10 seconds (excluding the browser login time).
- **SC-004**: All existing LLM features (streaming, cancellation, cascade regeneration) work identically regardless of which authentication method is active.
- **SC-005**: No OAuth tokens, API keys, or session data appear in browser console logs, frontend state dumps, or network request bodies visible to other origins.
- **SC-006**: Users who already have a ChatGPT Plus subscription can use MindFlow's AI features with zero additional cost or account setup beyond the initial sign-in.
