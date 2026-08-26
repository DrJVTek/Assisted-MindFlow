# Let OpenAI providers set a custom base URL (OpenAI-compatible proxy)

**Area:** ui · **Effort:** quick · **Depends on:** none

## Objective
Expose an optional 'Custom base URL (advanced)' field for openai-type providers in the Provider settings UI, wired to request.endpoint_url, so users can point an OpenAI provider at an OpenAI-compatible proxy. The entire backend already supports this — this is a UI-only change. Done = adding/editing an openai provider lets you type a base URL that is saved and round-trips.

## Files to touch
- `E:/Projects/github/Assisted MindFlow/frontend/src/components/ProviderSettingsPanel.tsx` — In the ADD form, when addType === 'openai' (and auth is api_key/oauth), render an optional 'Custom base URL (advanced)' text input bound to a new addBaseUrl state, and include it as request.endpoint_url in handleAdd. In the EDIT form, when provider.type === 'openai', render the same field bound to editEndpointUrl, and in handleSaveEdit send request.endpoint_url for openai (today line ~287 only sends it when auth_method === 'endpoint'). Use the existing inputStyle/labelStyle CSS-token styles.

## Steps
1. Open frontend/src/components/ProviderSettingsPanel.tsx.
2. ADD-FORM STATE: near the other add-form useState hooks (around line 196 where addEndpointUrl is declared), add: `const [addBaseUrl, setAddBaseUrl] = useState('');`.
3. ADD-FORM RESET: in handleTypeChange, when switching away from openai you may leave addBaseUrl as-is; in handleAdd's success branch (where addApiKey/addName/addModel are reset around line 254-256) add `setAddBaseUrl('');`.
4. ADD-FORM REQUEST: in handleAdd (around lines 236-248), after building the base `request` object and the existing api_key/endpoint branches, add: `if (addType === 'openai' && addBaseUrl.trim()) { request.endpoint_url = addBaseUrl.trim(); }`. (CreateProviderRequest already has endpoint_url?: string.)
5. ADD-FORM FIELD: in the add form JSX, just AFTER the api_key input block (the block guarded by `addAuthMethod === 'api_key'`, around lines 698-709), add a new block guarded by `addType === 'openai'` rendering a labeled text input: label 'Custom base URL (advanced)', value={addBaseUrl}, onChange sets addBaseUrl, placeholder e.g. 'https://my-proxy.example.com/v1 (leave empty for api.openai.com)', style={inputStyle}, label style={labelStyle}. Add a tiny helper line under it using color var(--node-text-muted) explaining it's for OpenAI-compatible proxies.
6. EDIT-FORM PREFILL: startEdit already sets editEndpointUrl from provider.endpoint_url (line ~271) for all types, so no change needed there.
7. EDIT-FORM FIELD: in the edit JSX, the Endpoint URL input currently only renders for `provider.auth_method === 'endpoint'` (around lines 511-522). Add an ADDITIONAL block guarded by `provider.type === 'openai'` that renders the same labeled input bound to editEndpointUrl/setEditEndpointUrl with label 'Custom base URL (advanced)'. Keep it separate from the endpoint-auth block so local providers are unaffected.
8. EDIT-FORM SAVE: in handleSaveEdit (around lines 287-289), the endpoint_url is only sent when `provider.auth_method === 'endpoint'`. Broaden it so openai also sends it, e.g.: `if ((provider.auth_method === 'endpoint' || provider.type === 'openai') && editEndpointUrl !== (provider.endpoint_url || '')) { request.endpoint_url = editEndpointUrl; }`. Sending '' must be allowed so a user can CLEAR a custom base URL back to default.
9. Run the app: add a new OpenAI provider with a custom base URL, reopen it, confirm the URL is shown; edit it to blank, save, confirm it clears. No backend change required.
10. Run frontend unit tests.

## Acceptance criteria
- [ ] The Add-provider form shows a 'Custom base URL (advanced)' field ONLY when type is openai; it is optional (empty is allowed and means default api.openai.com).
- [ ] On Add, a non-empty base URL is sent as endpoint_url and persists (visible after refetch/expand as the Endpoint detail row, which already renders when endpoint_url is set).
- [ ] The Edit form for an openai provider shows the base URL field prefilled with the saved value, and saving a changed/blank value updates endpoint_url (including clearing it back to empty).
- [ ] Local (endpoint) providers and other types are visually unchanged.
- [ ] All UI styling uses existing inputStyle/labelStyle (CSS tokens var(--...)), no hardcoded hex.
- [ ] Frontend unit tests pass.

## Verify
```
npm --prefix "E:/Projects/github/Assisted MindFlow/frontend" run test
npm --prefix "E:/Projects/github/Assisted MindFlow/frontend" run build
Backend regression (should stay green, no backend change): cd "E:/Projects/github/Assisted MindFlow" && venv\Scripts\python.exe -m pytest tests -o "addopts=" -p no:cacheprovider -q   # expect 654 passed
npm --prefix "E:/Projects/github/Assisted MindFlow/frontend" run dev   # http://127.0.0.1:5173 : Settings > Providers > Add > type=OpenAI API > enter Custom base URL > Add. Expand the provider, confirm Endpoint row shows it. Edit, blank the field, Save, confirm it clears.
```

## Gotchas
- Backend is ALREADY done — do not touch Python. provider_registry.py line ~327 calls OpenAIProvider(base_url=config.endpoint_url); CreateProviderRequest/UpdateProviderRequest and ProviderConfig all accept endpoint_url for any type; the endpoint_url validator (models/provider.py line ~76) only REQUIRES it for local/endpoint, so leaving it empty for openai is valid. This is purely a UI gap.
- The real bug to fix is handleSaveEdit at ProviderSettingsPanel.tsx line ~287: it gates endpoint_url on auth_method === 'endpoint', so an openai provider could never save a base URL even though the field exists. You MUST broaden that condition or the edit field silently does nothing (a no-FALLBACK / no-silent-noop violation).
- Allow sending an empty string on edit so users can revert to default api.openai.com — the condition compares against the previous value, so blanking a previously-set URL correctly sends endpoint_url: ''.
- Do not reuse the existing endpoint-auth field block for openai by loosening its guard — that block is meant for local/endpoint providers; add a separate openai-only block to avoid confusing the two auth flows.
- Keep the field labeled 'advanced' and optional with a clear placeholder so normal OpenAI users are not confused into thinking it is required.
- Commit atomically as e.g. `feat(015): optional custom base URL for OpenAI providers (compat proxies)`.
