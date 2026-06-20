# Persist UI theme across reloads + optional follow-system default

**Area:** ui · **Effort:** medium · **Depends on:** none

## Objective
Make the selected theme (and the rest of UIPreferences) survive a page reload via localStorage, and make the default theme configurable so it can follow the OS prefers-color-scheme on first run. Done = toggling to Light, reloading, and the app comes back Light; a brand-new user (empty localStorage) gets a theme matching their OS setting.

## Files to touch
- `E:/Projects/github/Assisted MindFlow/frontend/src/stores/canvasStore.ts` — Wrap the store creator in zustand's `persist` middleware (import { persist } from 'zustand/middleware'), persisting ONLY the `preferences` slice (use `partialize`) under a stable key like 'mindflow-ui-preferences'. Do NOT persist canvases/graphData/viewportStates/selection — those are server/session state.
- `E:/Projects/github/Assisted MindFlow/frontend/src/types/canvas.ts` — Add a helper to compute the default theme from prefers-color-scheme and use it for defaultPreferences.theme so first-run (no stored value) follows the OS. Keep the existing UIPreferences type unchanged.

## Steps
1. Open frontend/src/types/canvas.ts. Add an exported helper, e.g. `export function getSystemDefaultTheme(): 'light' | 'dark' { return (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light'; }`.
2. In the same file, change defaultPreferences so `theme: getSystemDefaultTheme(),` instead of the hardcoded 'dark'. Leave all other defaults as-is.
3. Open frontend/src/stores/canvasStore.ts. Add import: `import { persist } from 'zustand/middleware';`.
4. Wrap the existing store definition: change `create<CanvasStore>((set, get) => ({ ... }))` to `create<CanvasStore>()(persist((set, get) => ({ ... }), { name: 'mindflow-ui-preferences', partialize: (state) => ({ preferences: state.preferences }) }))`. Keep the entire existing body unchanged inside the first persist argument.
5. Because only `preferences` is persisted via partialize, the rehydrated state merges over `initialState` — verify that on reload `preferences` is restored and everything else (canvases, graphData, etc.) starts fresh from initialState.
6. Note the theme is APPLIED to the DOM by an effect in Canvas.tsx (lines ~191-198) that reads preferences.theme and toggles the `.dark` class + data-theme attribute. That effect already runs on mount, so once the persisted preferences rehydrate, the correct theme is applied — no change needed there. (Confirm there is no flash-of-wrong-theme that matters; if it does, it's acceptable for this card.)
7. Run the app: toggle theme to Light in Settings > Appearance, reload the page, confirm it stays Light. Then clear localStorage key 'mindflow-ui-preferences', set your OS to dark/light, reload, confirm first-run theme matches OS.
8. Run the frontend unit tests to make sure nothing regressed.

## Acceptance criteria
- [ ] After toggling theme and reloading the browser, the chosen theme persists (no reset to default).
- [ ] localStorage contains a key 'mindflow-ui-preferences' whose JSON has state.preferences.theme.
- [ ] Only the preferences slice is persisted — canvases, graphData, viewportStates, selection are NOT written to localStorage.
- [ ] With localStorage cleared, a fresh load picks theme from the OS prefers-color-scheme (dark OS -> dark app, light OS -> light app).
- [ ] grid/minimap/snapToGrid toggles in Appearance also persist across reload (they ride along in the same preferences object).
- [ ] Frontend unit tests pass.

## Verify
```
npm --prefix "E:/Projects/github/Assisted MindFlow/frontend" run test
npm --prefix "E:/Projects/github/Assisted MindFlow/frontend" run build
npm --prefix "E:/Projects/github/Assisted MindFlow/frontend" run dev   # http://127.0.0.1:5173 : Settings > Appearance > toggle Theme to Light, reload -> still Light. In devtools Application > Local Storage, confirm key 'mindflow-ui-preferences'. Clear it, flip OS dark mode, reload -> theme follows OS.
```

## Gotchas
- zustand is v5 (^5.0.8) — the curried form is REQUIRED: `create<CanvasStore>()(persist(...))` with the empty `()` after create<...>. Forgetting the `()` is the classic v5 type error.
- Use `partialize` to persist ONLY preferences. If you persist the whole store, stale canvases/graphData/viewportStates will be written and rehydrated, breaking multi-canvas state and causing bugs. This is a real correctness issue, not cosmetic.
- getSystemDefaultTheme() runs at module load when defaultPreferences is constructed; guard for SSR/no-matchMedia with the typeof window check so unit tests (jsdom) don't crash — jsdom supports matchMedia via the setup but the guard keeps it safe.
- Do NOT add a fallback that silently swallows a corrupt localStorage value into a hardcoded theme beyond zustand's own default rehydrate behavior — keep it to the OS default + persisted value (respects the NO-FALLBACK rule; the OS default is the explicit configured default, not a silent substitution).
- The DOM theme effect lives in Canvas.tsx, not in the store — don't duplicate that logic; just rely on it reading the now-persisted preferences.theme.
- Commit atomically as e.g. `feat(015): persist UI preferences (theme) in localStorage + follow-system default`.
