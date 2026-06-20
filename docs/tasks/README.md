# Task cards

Executable task cards. Read ../CONVENTIONS.md first. Big 'vision' items (Thread mode, MCP in/out, groups, debate, web/proxy providers) are NOT here — they need design, see ../ROADMAP.md.

## Backend

- [ ] [Migrate startup event to FastAPI lifespan + single composition root](be-lifespan-composition-root.md) — medium
- [ ] [Consolidate the two MCP server modules into one](be-dedup-mcp-server.md) — medium
- [ ] [Reorganize src/mindflow/services/ grab-bag into sub-packages (behavior-preserving)](be-tidy-services.md) — medium
- [ ] [Consolidate the three overlapping test trees into one layout](be-consolidate-test-trees.md) — medium
- [ ] [Install dev extras so tests run after a fresh install (install.bat + install.sh)](be-installbat-dev-deps.md) — quick
- [ ] [Replace deprecated pydantic FieldValidationInfo with ValidationInfo](be-pydantic-deprecation.md) — quick
- [ ] [Add an automated guard that fails if engine/ imports mindflow.api](be-layering-lint.md) — quick
- [ ] [DECISION REQUIRED: Kill or wire the dead dirty/clean cache in GraphExecutor](be-engine-cache-decision.md) — medium — ⚠ needs decision

## UI

- [ ] [Polish canvas node visuals (typography, spacing, header, hover/selected) using CSS tokens](ui-node-refinement.md) — medium
- [ ] [Migrate flat components/ to feature folders and decompose the Canvas god-component](ui-frontend-modularization.md) — large
- [ ] [Integrate brand: track logo assets, add favicon + app top bar](ui-branding.md) — medium
- [ ] [Persist UI theme across reloads + optional follow-system default](ui-theme-persistence.md) — medium
- [ ] [Let OpenAI providers set a custom base URL (OpenAI-compatible proxy)](ui-openai-endpoint-field.md) — quick
