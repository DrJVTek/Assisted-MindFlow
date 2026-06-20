# Task cards

Executable task cards. Read ../CONVENTIONS.md first. Big 'vision' items (Thread mode, MCP in/out, groups, debate, web/proxy providers) are NOT here — they need design, see ../ROADMAP.md.

## Backend

- [x] [Migrate startup event to FastAPI lifespan + single composition root](be-lifespan-composition-root.md) — medium
- [x] [Consolidate the two MCP server modules into one](be-dedup-mcp-server.md) — medium
- [x] [Reorganize src/mindflow/services/ grab-bag into sub-packages (behavior-preserving)](be-tidy-services.md) — medium
- [x] [Consolidate the three overlapping test trees into one layout](be-consolidate-test-trees.md) — medium
- [x] [Install dev extras so tests run after a fresh install (install.bat + install.sh)](be-installbat-dev-deps.md) — quick
- [x] [Replace deprecated pydantic FieldValidationInfo with ValidationInfo](be-pydantic-deprecation.md) — quick
- [x] [Add an automated guard that fails if engine/ imports mindflow.api](be-layering-lint.md) — quick
- [x] [Kill the dead dirty/clean cache in GraphExecutor (chose OPTION-KILL)](be-engine-cache-decision.md) — medium

## UI

- [x] [Polish canvas node visuals (typography, spacing, header, hover/selected) using CSS tokens](ui-node-refinement.md) — medium
- [x] [Migrate flat components/ to feature folders](ui-frontend-modularization.md) — large *(folder migration done + verified end-to-end; the optional, design-sensitive Canvas internal decomposition is deferred per the card's own guidance)*
- [x] [Integrate brand: track logo assets, add favicon + app top bar](ui-branding.md) — medium
- [x] [Persist UI theme across reloads + optional follow-system default](ui-theme-persistence.md) — medium
- [x] [Let OpenAI providers set a custom base URL (OpenAI-compatible proxy)](ui-openai-endpoint-field.md) — quick
- [x] **Unbreak the frontend production build** — fixed 20 pre-existing `tsc` errors (removed dead code + unused imports/vars + 1 null-coalescing fix). `npm run build` is green. *(discovered & done 2026-06-20)*
