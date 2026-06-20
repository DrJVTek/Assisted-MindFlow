# Migrate flat components/ to feature folders and decompose the Canvas god-component

**Area:** ui · **Effort:** large · **Depends on:** none

## Objective
Reorganize frontend/src/components/ (~32 files) into a feature-based structure under frontend/src/features/{canvas,nodes,execution,providers,plugins,mcp,debate,settings,logging,import}, keeping frontend/src/components/ui as the shared design system, and decompose the 1472-line Canvas.tsx god-component into smaller pieces. The app must stay runnable after EVERY incremental step (move one feature, fix its imports, verify build, repeat).

## Files to touch
- `frontend/src/features/` — Create new feature subfolders and move components in (see mapping). Each moved file's relative imports to ../stores, ../services, ../types must be re-pathed one level deeper (../ -> ../../../ since feature components sit 3 levels under src).
- `frontend/src/components/Canvas.tsx` — Decompose: extract the panel-layer JSX (DetailPanel/SettingsPanel/DebateControls/ImportDialog/ContextMenu/NodeCreator/NodeEditor/VersionHistory wiring, lines ~1356-1465) and the keyboard-shortcut effect (ends ~line 984) into child components/hooks. Canvas stays the orchestrator.
- `frontend/src/App.tsx` — Update `import { Canvas } from './components/Canvas'` (line 7) to the new features/canvas path once Canvas moves.
- `frontend/src/components/` — After migration, only components/ui (Button, Dialog, Input, Card) plus optionally ErrorBoundary/ResizableDivider remain.

## Steps
1. PRECONDITION (verified): there are NO path aliases (no @/ in tsconfig*.json or vite.config.ts). All imports are RELATIVE and depth-sensitive. Moving a file from src/components/ (1 level deep: `../stores`) into src/features/<feat>/components/ (3 levels deep) requires `../../../stores`. Re-path every `../stores`/`../services`/`../types`/`../hooks`/`../utils` to `../../../...` in each moved file. Run `npx tsc -b --noEmit` after every move.
2. TARGET LAYOUT (create folders as you go):
  features/canvas/components/  (ALREADY EXISTS: CanvasNavigator) -> add Canvas.tsx, ConnectionValidator.tsx, ContextMenu.tsx, CompositeNode.tsx + extracted Canvas children
  features/nodes/components/   -> Node.tsx, GroupNode.tsx, CommentNode.tsx, NodeCreator.tsx, NodeEditor.tsx, DetailPanel.tsx, LLMNodeContent.tsx(+.css), DynamicNodeView.tsx, MarkdownRenderer.tsx, VersionHistory.tsx
  features/execution/components/ -> (only if exec UI is extracted from Canvas; executionStore stays in stores/)
  features/providers/components/ -> ProviderSelector.tsx, ProviderSettingsPanel.tsx, ModelSelector.tsx, OAuthLoginButton.tsx
  features/plugins/components/   -> PluginManagerPanel.tsx
  features/mcp/components/       -> MCPConnectionsPanel.tsx, MCPToolBrowser.tsx
  features/debate/components/    -> DebateControls.tsx
  features/settings/components/  -> SettingsPanel.tsx
  features/logging/components/   -> LogPanel.tsx
  features/import/components/    -> ImportConversationDialog.tsx
  components/ui/                 -> KEEP AS-IS (Button, Dialog, Input, Card) = design system
  ResizableDivider.tsx, ErrorBoundary.tsx -> shared: keep in components/ OR move to components/ui; pick one and be consistent.
3. FILE -> FEATURE MAPPING (grounded in actual imports):
  CANVAS: Canvas.tsx; ConnectionValidator.tsx (exports useConnectionValidator/isTypeCompatible/isImplicitConversion, only importer = Canvas); ContextMenu.tsx; CanvasNavigator.tsx (already there); CompositeNode.tsx (not imported by Canvas — verify its importer with grep before moving).
  NODES: Node.tsx, GroupNode.tsx, CommentNode.tsx, NodeCreator.tsx, NodeEditor.tsx, DetailPanel.tsx (imports ./LLMNodeContent + ./DynamicNodeView), LLMNodeContent.tsx + LLMNodeContent.css (imports ./ResizableDivider, ./MarkdownRenderer, ./ui/Button), DynamicNodeView.tsx, MarkdownRenderer.tsx, VersionHistory.tsx.
  PROVIDERS: ProviderSelector.tsx, ProviderSettingsPanel.tsx, ModelSelector.tsx, OAuthLoginButton.tsx.
  PLUGINS: PluginManagerPanel.tsx.
  MCP: MCPConnectionsPanel.tsx, MCPToolBrowser.tsx.
  DEBATE: DebateControls.tsx.
  SETTINGS: SettingsPanel.tsx (imports ./ProviderSettingsPanel, ./MCPConnectionsPanel, ./PluginManagerPanel).
  LOGGING: LogPanel.tsx.
  IMPORT: ImportConversationDialog.tsx.
4. SAFE INCREMENTAL ORDER — migrate LEAF features first (fewest dependents), ONE feature per commit, build-verifying between each:
  1. mcp (MCPConnectionsPanel, MCPToolBrowser — only imported by SettingsPanel)
  2. plugins (PluginManagerPanel — only by SettingsPanel)
  3. providers (Provider*/ModelSelector/OAuthLoginButton)
  4. debate (DebateControls — only by Canvas)
  5. logging (LogPanel — only by Canvas)
  6. import (ImportConversationDialog — only by Canvas)
  7. settings (SettingsPanel — now repoint its imports to the moved mcp/plugins/providers paths)
  8. nodes (biggest batch; DetailPanel + LLMNodeContent sibling imports stay `./` within the feature)
  9. canvas LAST (Canvas.tsx, ConnectionValidator, ContextMenu) — it imports nearly everything; update its many import paths once all targets settled, and update App.tsx here.
5. PER-MOVE PROCEDURE (repeat for each file): (a) `git mv src/components/X.tsx src/features/<feat>/components/X.tsx`; (b) in the moved file, rewrite every `from '../stores/...'`/`'../services/...'`/`'../types/...'`/`'../hooks/...'`/`'../utils/...'` to `'../../../...'` (feature components are 3 levels under src); (c) sibling imports that moved into the SAME folder keep `'./Sibling'`; (d) grep for every OTHER file importing X (`from '.*X'`) and update those paths; (e) run `npx tsc -b --noEmit` — do not proceed until green.
6. OPTIONAL barrels: add an `index.ts` per feature re-exporting its public components, so external imports become `from '../nodes'`. OPTIONAL polish — only after the raw moves build green, and only if it reduces churn. Do NOT block the migration on barrels.
7. CANVAS DECOMPOSITION (after the move, separate commits) — Canvas.tsx is 1472 lines. Extract in this order, build-verifying each:
  (1) Keyboard-shortcuts useEffect (ends ~line 984, returns removeEventListener) -> hook features/canvas/hooks/useCanvasKeyboardShortcuts.ts taking needed callbacks/refs as args.
  (2) Modal/panel layer JSX (lines ~1356-1465: DetailPanel, DebateControls, SettingsPanel, ImportConversationDialog, ContextMenu, NodeCreator, NodeEditor, VersionHistory) -> a presentational CanvasOverlays.tsx receiving open-state + handlers as props. Biggest readability win.
  (3) The three early-return loading/empty states (lines ~989-1110, each rendering SettingsPanel) -> a small CanvasStatusScreen.tsx.
  Keep all useState/useCallback orchestration IN Canvas. This split is DESIGN-sensitive: do not over-extract. If a clean prop boundary isn't obvious for a block, leave it in Canvas rather than invent a leaky abstraction.
8. After all moves + extraction: confirm src/components/ contains only `ui/` (+ optionally ErrorBoundary/ResizableDivider if kept shared). Update docs ONLY if an existing doc in docs/ already describes the folder layout (search first; do not create new docs — project rule forbids unauthorized files).

## Acceptance criteria
- [ ] Every component in the mapping lives under its feature folder; components/ retains only the ui/ design system (and any intentionally-shared ErrorBoundary/ResizableDivider).
- [ ] `npx tsc -b --noEmit` passes with 0 errors at the final state (ideally after each incremental commit too).
- [ ] `cd frontend && npm run build` succeeds (tsc -b && vite build), and the dev server renders the canvas with nodes, panels, settings, log panel, debate controls all functional.
- [ ] Canvas.tsx is materially smaller (panel-layer JSX + keyboard-shortcut effect extracted into CanvasOverlays + useCanvasKeyboardShortcuts); no behavior change.
- [ ] No import points at an old `./components/...` path or a wrong-depth `../stores` (grep returns nothing stale).
- [ ] Each feature migrated as its own atomic commit `refactor(015): move <feature> to features/<feature>` with the app runnable between commits.

## Verify
```
After EACH feature move: cd frontend && npx tsc -b --noEmit  (0 errors) — do not proceed to the next feature until green.
Final: cd frontend && npm run build  (tsc -b && vite build must both succeed).
cd frontend && npm run lint  (no new unresolved-import / unused errors).
grep -rn "from '\.\./components/" frontend/src  — should return nothing once Canvas/App moved (no stragglers on the old flat path).
grep -rn "from '\.\./stores" frontend/src/features  — feature components are 3 deep, so correct is '../../../stores'; this 2-dot grep should return ZERO results.
Run the app from repo root (restart.bat), open http://127.0.0.1:5173 — manually exercise: open Settings (providers/plugins/mcp tabs render), select a node (DetailPanel opens — it is lazy-loaded, so a wrong path fails only at runtime), open the log panel, trigger debate controls, run the import dialog. All must work.
Backend baseline unaffected: venv\Scripts\python.exe -m pytest tests -o "addopts=" -p no:cacheprovider -q  (still 654 passed / 0 failed).
```

## Gotchas
- NO PATH ALIASES exist (verified: no @/ in tsconfig*.json or vite.config.ts). Imports are relative and depth-sensitive. Moving src/components/X (1 level: ../stores) to src/features/feat/components/X (3 levels: ../../../stores) breaks EVERY store/service/type import unless re-pathed. This is the dominant failure mode — re-path and tsc-check after every single move.
- features/canvas ALREADY EXISTS with hooks/utils/services/components (CanvasNavigator, useGraphData, transform, etc.) that already use the CORRECT 3-deep `../../../stores` pattern (e.g. useGraphData.ts line 10). Match it. Canvas.tsx currently imports these as `../features/canvas/...` — after Canvas moves INTO features/canvas/components, those imports become `../hooks/...`, `../utils/...`, `../components/...`.
- DetailPanel is LAZY-loaded in Canvas via `lazy(() => import('./DetailPanel'))` (line ~60). When DetailPanel moves to features/nodes, update this dynamic import path too — a wrong dynamic import path fails at RUNTIME, not at tsc, so it slips past the type check. Test the running app.
- SettingsPanel imports ProviderSettingsPanel, MCPConnectionsPanel, PluginManagerPanel as `./X`. After those move to other features, SettingsPanel's imports become cross-feature `../../providers/components/...` etc. Migrate SettingsPanel AFTER its three dependencies (order step 7).
- LLMNodeContent imports ./ResizableDivider, ./MarkdownRenderer, ./ui/Button; NodeEditor imports ./ui/Dialog, ./ui/Button. Decide ResizableDivider's home first: LLMNodeContent is its only sibling importer, so moving ResizableDivider into features/nodes keeps that import `./`. ui/* always stays in components/ui (cross-path `../../../components/ui/Button` from a feature).
- ConnectionValidator.tsx exports a HOOK + pure fns (it is canvas-domain logic, not a visual component) — it belongs in features/canvas (hooks or components). Only importer is Canvas.
- Canvas decomposition is partly a DESIGN call: the panel-layer extraction has a clean prop boundary and is safe; deeper splitting of the React Flow handler soup (onConnect/onNodesChange/onEdgesDelete/etc., lines ~295-490) has NO obvious clean boundary — leave it in Canvas unless a reviewer explicitly wants a useCanvasHandlers hook. Do not force it.
- Frontend currently has NO test files (vitest run reports 'no tests'), so `npm run test` is NOT a meaningful gate. The real gates are `tsc -b --noEmit` (types) and `npm run build` + manual app run (runtime). Never claim success on `npm run test` alone.
