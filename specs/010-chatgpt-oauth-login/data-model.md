# Data Model: ChatGPT OAuth Login

**Feature Branch**: `010-chatgpt-oauth-login`
**Date**: 2026-03-13

## Entities

### OAuthSession

Represents an active or persisted ChatGPT OAuth session.

| Field | Type | Description | Constraints |
| ----- | ---- | ----------- | ----------- |
| access_token | string | OAuth Bearer access token | Required, encrypted at rest |
| refresh_token | string | OAuth refresh token | Required, encrypted at rest |
| expires_at | datetime | Token expiry timestamp (UTC) | Required |
| token_type | string | Always "Bearer" | Required, default: "Bearer" |
| subscription_tier | string | Detected subscription level | Optional, values: "free", "plus", "pro", "business", "enterprise" |
| user_email | string | OpenAI account email | Optional, for display only |
| created_at | datetime | When the session was first created | Required, auto-set |
| last_refreshed_at | datetime | Last successful token refresh | Optional |

**Lifecycle / State Transitions:**

```
[Not Connected] → (Sign in flow) → [Connected]
[Connected] → (Token expires, refresh succeeds) → [Connected]
[Connected] → (Token expires, refresh fails) → [Session Expired]
[Session Expired] → (Re-sign in) → [Connected]
[Connected] → (Sign out) → [Not Connected]
[Connected] → (Subscription downgrade/cancel) → [Auth Error]
[Auth Error] → (Re-sign in or switch to API key) → [Connected] or [Not Connected]
```

**Storage**: Encrypted JSON file at `data/oauth/session.enc`. A salt file `data/oauth/.salt` is generated on first use for key derivation.

---

### AuthMethod

Represents the selected authentication strategy for the OpenAI provider.

| Field | Type | Description | Constraints |
| ----- | ---- | ----------- | ----------- |
| type | string | Authentication method type | Required, values: "api_key", "chatgpt_oauth" |
| is_active | boolean | Whether this method is currently selected | Required |

**Storage**: Part of the provider configuration in `config/config.json` under the OpenAI provider section.

---

### ProviderConfig (Extended)

Extension of the existing provider configuration to support dual auth methods.

| Field | Type | Description | Constraints |
| ----- | ---- | ----------- | ----------- |
| provider_type | string | "openai" | Existing field |
| api_key_env | string | Environment variable name for API key | Existing field |
| auth_method | string | Selected auth method | New field, values: "api_key" (default), "chatgpt_oauth" |
| oauth_session_file | string | Path to encrypted session file | New field, default: "data/oauth/session.enc" |
| detected_models | list[string] | Models detected via API after OAuth | New field, cached after sign-in |
| selected_model | string | User's chosen model from detected list | New field |

---

### OAuthCallbackState

Temporary in-memory state during the OAuth flow (not persisted).

| Field | Type | Description | Constraints |
| ----- | ---- | ----------- | ----------- |
| code_verifier | string | PKCE code verifier (32 random bytes, base64url) | Generated per flow |
| code_challenge | string | SHA256 of verifier (base64url) | Derived from verifier |
| state | string | Random state parameter for CSRF protection | Generated per flow |
| redirect_port | integer | Port of local callback HTTP server | Dynamically assigned |
| status | string | Flow status | Values: "pending", "completed", "cancelled", "error" |

## Relationships

```
ProviderConfig (openai)
  ├── auth_method: "api_key" → uses api_key_env (existing flow)
  └── auth_method: "chatgpt_oauth" → uses OAuthSession (new flow)
                                        └── encrypted in session.enc
```

## Validation Rules

- Only one `auth_method` can be active at a time per provider
- `OAuthSession.access_token` must never appear in logs or frontend responses
- `OAuthSession.expires_at` must be checked before every API call (5-minute buffer for preemptive refresh)
- `detected_models` list is cleared when signing out or switching auth method
- `data/oauth/.salt` must not be committed to git (added to `.gitignore`)
- `data/oauth/session.enc` must not be committed to git (added to `.gitignore`)
