# Tasks: Node Icon Customization

**Input**: Design documents from `/specs/005-node-icon-customization/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api-icons.yaml

**Tests**: Following TDD approach - tests written FIRST, ensure they FAIL, then implement

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `backend/` (Python/FastAPI), `frontend/` (React/TypeScript)
- Frontend paths: `frontend/src/`, `frontend/tests/`
- Backend paths: `src/mindflow/`, `tests/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 [P] Create frontend icon components directory structure at `frontend/src/components/icons/`
- [X] T002 [P] Create backend icon routes directory at `src/mindflow/api/routes/` (verify exists)
- [X] T003 [P] Create backend icon service directory at `src/mindflow/services/` (verify exists)
- [X] T004 [P] Create frontend icon tests directory at `frontend/tests/components/icons/`
- [X] T005 [P] Create backend icon tests directory at `tests/unit/` and `tests/integration/` (verify exists)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core icon infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T006 [P] Extend NodeMetadata TypeScript interface in `frontend/src/types/graph.ts` to add `custom_icon?: string | null` and `icon_source?: 'default' | 'user' | 'ai'`
- [ ] T007 [P] Extend NodeMetadata Python model in `src/mindflow/models/graph.py` to add `custom_icon: Optional[str] = None` and `icon_source: Literal['default', 'user', 'ai'] = 'default'`
- [ ] T008 [P] Create IconRegistry TypeScript types in `frontend/src/components/icons/types.ts` with IconName, IconDefinition, IconCategory
- [ ] T009 Create IconRegistry implementation in `frontend/src/components/icons/registry.ts` mapping all lucide-react icons to components with categories and keywords (500+ icons)
- [ ] T010 [P] Create IconFavorites localStorage utility in `frontend/src/components/icons/favorites.ts` with load/save/add/remove functions

**Checkpoint**: Foundation ready - icon infrastructure in place, user story implementation can begin in parallel

---

## Phase 3: User Story 4 - Icon Preview in Node List and Canvas (Priority: P1) 🎯 MVP Foundation

**Goal**: Custom icons display correctly everywhere nodes appear (canvas, lists, history) with graceful fallback to type-based defaults

**Why P1 First**: This is foundation for ALL other stories - need display working before selection/AI features make sense

**Independent Test**: Create node with `custom_icon: "heart"` manually in JSON, verify heart icon displays on canvas; set invalid icon name, verify fallback to type-based icon

### Tests for User Story 4 ⚠️ RED Phase

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T011 [P] [US4] Unit test for icon registry lookup in `frontend/tests/components/icons/registry.test.ts` (test getIcon, searchIcons, getIconsByCategory)
- [ ] T012 [P] [US4] Unit test for icon fallback logic in `frontend/tests/components/icons/registry.test.ts` (test invalid icon names return null)
- [ ] T013 [P] [US4] Component test for Node with custom icon in `frontend/tests/components/Node.test.tsx` (test custom icon renders, fallback works)

### Implementation for User Story 4 ⚠️ GREEN Phase

- [ ] T014 [US4] Modify getNodeIcon function in `frontend/src/components/Node.tsx` to check node.meta.custom_icon and use icon registry with fallback to getTypeIcon
- [ ] T015 [US4] Add error logging for invalid icon names in `frontend/src/components/Node.tsx` (console.warn when custom_icon not found in registry)
- [ ] T016 [US4] Verify custom icons display in Canvas component `frontend/src/components/Canvas.tsx` (no changes needed, but test rendering)
- [ ] T017 [P] [US4] Add backend validation for custom_icon field in `src/mindflow/models/graph.py` (pattern: `^[a-z][a-z0-9-]*$`, max length 50)

**Checkpoint**: Custom icons now display everywhere. Can manually test by editing graph JSON to add custom_icon field.

---

## Phase 4: User Story 1 - Manual Icon Selection on Node Creation (Priority: P1) 🎯 MVP Core

**Goal**: Users can manually select icons from lucide-react library when creating/editing nodes

**Independent Test**: Create new node → icon picker opens → search "heart" → select heart → node displays with heart icon → edit node → heart icon shown in picker → change to "star" → star icon displays

### Tests for User Story 1 ⚠️ RED Phase

- [ ] T018 [P] [US1] Component test for IconPicker rendering in `frontend/tests/components/icons/IconPicker.test.tsx` (test grid layout, categories, icons render)
- [ ] T019 [P] [US1] Component test for IconPicker selection in `frontend/tests/components/icons/IconPicker.test.tsx` (test click-to-select, onSelect callback)
- [ ] T020 [P] [US1] Component test for IconPicker close behavior in `frontend/tests/components/icons/IconPicker.test.tsx` (test outside click, ESC key)
- [ ] T021 [P] [US1] Integration test for node creation with custom icon in `frontend/tests/integration/iconSelection.test.ts` (test full flow: create node → pick icon → save → verify)

### Implementation for User Story 1 ⚠️ GREEN Phase

- [ ] T022 [P] [US1] Create IconPicker component UI skeleton in `frontend/src/components/icons/IconPicker.tsx` (grid layout, categories tabs, search input, close button)
- [ ] T023 [US1] Implement icon grid rendering in `frontend/src/components/icons/IconPicker.tsx` using iconRegistry with virtual scrolling (react-window or similar)
- [ ] T024 [US1] Implement category filtering in `frontend/src/components/icons/IconPicker.tsx` (filter icons by selected category)
- [ ] T025 [US1] Implement icon selection logic in `frontend/src/components/icons/IconPicker.tsx` (click handler, onSelect callback, close picker)
- [ ] T026 [US1] Add IconPicker to node creation flow in `frontend/src/components/Canvas.tsx` (add icon selector button/UI to node creation dialog)
- [ ] T027 [US1] Add IconPicker to node edit flow in `frontend/src/components/Canvas.tsx` (show current icon, allow change via IconPicker)
- [ ] T028 [US1] Update node save logic in `frontend/src/services/api.ts` to persist custom_icon and icon_source='user' to backend

**Checkpoint**: Users can now manually select icons. Icon picker works, icons persist, full create/edit flow functional.

---

## Phase 5: User Story 3 - Icon Search and Favorites (Priority: P3)

**Goal**: Users can search icons by keywords and mark favorites for quick access (productivity feature)

**Independent Test**: Open icon picker → type "chart" in search → see filtered chart icons → star 3 icons → close/reopen picker → favorites section shows 3 starred icons → unstar one → favorites updates

### Tests for User Story 3 ⚠️ RED Phase

- [ ] T029 [P] [US3] Component test for icon search in `frontend/tests/components/icons/IconPicker.test.tsx` (test search filters icons by keywords in real-time)
- [ ] T030 [P] [US3] Component test for favorites functionality in `frontend/tests/components/icons/IconPicker.test.tsx` (test star/unstar, favorites section)
- [ ] T031 [P] [US3] Unit test for favorites persistence in `frontend/tests/components/icons/favorites.test.ts` (test localStorage load/save/add/remove)

### Implementation for User Story 3 ⚠️ GREEN Phase

- [ ] T032 [US3] Add search input functionality to IconPicker in `frontend/src/components/icons/IconPicker.tsx` (debounced search, filter by keywords)
- [ ] T033 [US3] Implement search filtering logic in `frontend/src/components/icons/IconPicker.tsx` using iconRegistry keywords (real-time filter, case-insensitive)
- [ ] T034 [US3] Add favorites UI to IconPicker in `frontend/src/components/icons/IconPicker.tsx` (star icons, favorites section at top)
- [ ] T035 [US3] Integrate IconFavorites utility in IconPicker in `frontend/src/components/icons/IconPicker.tsx` (load favorites on mount, save on star/unstar)
- [ ] T036 [US3] Add "no results" message in IconPicker in `frontend/src/components/icons/IconPicker.tsx` (show when search returns empty)

**Checkpoint**: Icon picker now has search and favorites. Power users can quickly access commonly used icons.

---

## Phase 6: User Story 2 - AI-Powered Icon Suggestion (Priority: P2)

**Goal**: AI suggests contextually relevant icons based on node content, with user accept/reject control

**Independent Test**: Create node with content "What are the performance metrics?" → AI suggests "gauge" or "chart-bar" → accept suggestion → icon applied with icon_source='ai' → create node "Database schema question" → AI suggests "database" icon

### Tests for User Story 2 ⚠️ RED Phase

- [ ] T037 [P] [US2] Backend unit test for IconService in `tests/unit/test_icon_service.py` (test suggest_icon logic, LLM prompt building)
- [ ] T038 [P] [US2] Backend integration test for icon suggestion endpoint in `tests/integration/test_icons_api.py` (test POST /api/icons/suggest with valid/invalid requests)
- [ ] T039 [P] [US2] Backend integration test for suggestion timeout in `tests/integration/test_icons_api.py` (test 3s timeout enforced, graceful fallback)
- [ ] T040 [P] [US2] Component test for AI suggestion UI in `frontend/tests/components/icons/IconPicker.test.tsx` (test suggestion badge, accept/reject buttons)

### Implementation for User Story 2 ⚠️ GREEN Phase

**Backend Implementation:**

- [ ] T041 [P] [US2] Create IconSuggestionRequest Pydantic model in `src/mindflow/models/graph.py` (node_type, content, current_icon fields)
- [ ] T042 [P] [US2] Create IconSuggestionResponse Pydantic model in `src/mindflow/models/graph.py` (suggested_icon, confidence, reasoning fields)
- [ ] T043 [US2] Create IconService class in `src/mindflow/services/icon_service.py` with suggest_icon method using LLMManager
- [ ] T044 [US2] Build LLM prompt for icon suggestion in `src/mindflow/services/icon_service.py` (include node type, content 200 chars, icon list, ask for single icon name)
- [ ] T045 [US2] Add 3-second timeout handling in `src/mindflow/services/icon_service.py` (asyncio.wait_for with 3s timeout)
- [ ] T046 [US2] Create /api/icons/suggest POST endpoint in `src/mindflow/api/routes/icons.py` (use IconService, handle 200/400/408/500 responses per contract)
- [ ] T047 [P] [US2] Create /api/icons/registry GET endpoint in `src/mindflow/api/routes/icons.py` (return icon metadata with category/keywords filtering)
- [ ] T048 [P] [US2] Create /api/icons/validate POST endpoint in `src/mindflow/api/routes/icons.py` (validate icon name against lucide-react registry)
- [ ] T049 [US2] Register icon routes in `src/mindflow/api/server.py` (include_router for icons)

**Frontend Implementation:**

- [ ] T050 [P] [US2] Add icon suggestion API client in `frontend/src/services/api.ts` (suggestIcon function calling POST /api/icons/suggest)
- [ ] T051 [US2] Add AI suggestion state to IconPicker in `frontend/src/components/icons/IconPicker.tsx` (aiSuggestion, isLoadingSuggestion state)
- [ ] T052 [US2] Fetch AI suggestion on IconPicker mount in `frontend/src/components/icons/IconPicker.tsx` (call api.suggestIcon with node content)
- [ ] T053 [US2] Display AI suggestion badge in IconPicker in `frontend/src/components/icons/IconPicker.tsx` ("✨ AI suggests: [icon]" with accept/reject buttons)
- [ ] T054 [US2] Implement accept suggestion in IconPicker in `frontend/src/components/icons/IconPicker.tsx` (set custom_icon, icon_source='ai', close picker)
- [ ] T055 [US2] Implement reject suggestion in IconPicker in `frontend/src/components/icons/IconPicker.tsx` (hide suggestion, allow manual selection)
- [ ] T056 [US2] Add caching for AI suggestions in `frontend/src/components/icons/IconPicker.tsx` (localStorage cache by content hash, 24h expiry)

**Checkpoint**: AI now suggests icons. Users see suggestions, can accept/reject, manual selection still works if AI fails.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T057 [P] Add keyboard navigation to IconPicker in `frontend/src/components/icons/IconPicker.tsx` (arrow keys, enter to select, ESC to close)
- [ ] T058 [P] Add ARIA labels and screen reader support in `frontend/src/components/icons/IconPicker.tsx` (aria-label, role attributes, announcements)
- [ ] T059 [P] Optimize IconPicker performance in `frontend/src/components/icons/IconPicker.tsx` (memoize icon components, optimize virtual scrolling)
- [ ] T060 [P] Add loading states to IconPicker in `frontend/src/components/icons/IconPicker.tsx` (spinner while fetching AI suggestion)
- [ ] T061 [P] Add error boundaries around icon rendering in `frontend/src/components/Node.tsx` (prevent icon errors from crashing canvas)
- [ ] T062 [P] Add backend icon name validation in `src/mindflow/services/icon_service.py` (validate suggested icons exist in lucide-react)
- [ ] T063 [P] Add icon usage logging in `src/mindflow/services/icon_service.py` (log suggestions for analytics/improvement)
- [ ] T064 [P] Update README.md to document icon customization feature
- [ ] T065 Run quickstart.md validation checklist from `specs/005-node-icon-customization/quickstart.md`
- [ ] T066 [P] Backend code formatting with black/ruff in `src/mindflow/services/icon_service.py` and `src/mindflow/api/routes/icons.py`
- [ ] T067 [P] Frontend code linting with ESLint in `frontend/src/components/icons/`
- [ ] T068 Run full test suite and verify 80%+ coverage for new code

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 4 (Phase 3)**: Depends on Foundational - Display infrastructure (MUST complete first - foundation for other stories)
- **User Story 1 (Phase 4)**: Depends on US4 completion - Manual selection (MVP core feature)
- **User Story 3 (Phase 5)**: Depends on US1 completion - Search/Favorites (extends IconPicker from US1)
- **User Story 2 (Phase 6)**: Depends on US1 completion - AI suggestions (integrates with IconPicker from US1)
- **Polish (Phase 7)**: Depends on desired user stories being complete

### User Story Dependencies

**Dependency Chain**:
```
Foundational (Phase 2)
    ↓
User Story 4 (Display) - P1 Foundation ← MUST COMPLETE FIRST
    ↓
User Story 1 (Manual Selection) - P1 MVP ← Core Feature
    ├→ User Story 3 (Search/Favorites) - P3 ← Extends IconPicker
    └→ User Story 2 (AI Suggestions) - P2 ← Integrates with IconPicker
```

**Why This Order**:
- US4 first: Need icon display working before selection makes sense
- US1 second: Core manual selection is MVP, creates IconPicker component
- US2 & US3 parallel: Both extend US1's IconPicker, can work in parallel after US1

### Within Each User Story

- Tests MUST be written and FAIL before implementation (TDD RED phase)
- Tests → Models → Services → Components → Integration
- Test failures → Implementation (GREEN phase) → Refactoring if needed
- Story complete before moving to next priority

### Parallel Opportunities

**Phase 2 (Foundational)**:
- T006 (Frontend types), T007 (Backend models), T008 (Icon types) can run in parallel
- T010 (Favorites utility) can run in parallel with registry work

**Phase 3 (US4 Tests)**:
- T011, T012, T013 (all US4 tests) can run in parallel

**Phase 4 (US1 Tests)**:
- T018, T019, T020 (IconPicker tests) can run in parallel
- T022 (IconPicker skeleton) can be done while tests are being written

**Phase 6 (US2 Backend)**:
- T041, T042 (Pydantic models) can run in parallel
- T047, T048 (registry/validate endpoints) can run in parallel after T046

**Phase 7 (Polish)**:
- T057-T063 (all polish tasks) can run in parallel except T065 (validation depends on all)

**Multi-Developer Strategy**:
- After Foundational: Developer A on US4, Developer B on test infrastructure
- After US4: Developer A on US1, Developer B on US2 backend prep
- After US1: Developer A on US3, Developer B on US2, parallel completion

---

## Parallel Example: User Story 4

```bash
# Launch all tests for User Story 4 together (TDD RED phase):
Task T011: "Unit test for icon registry lookup in frontend/tests/components/icons/registry.test.ts"
Task T012: "Unit test for icon fallback logic in frontend/tests/components/icons/registry.test.ts"
Task T013: "Component test for Node with custom icon in frontend/tests/components/Node.test.tsx"

# After tests fail, can parallelize some implementation:
# (T014 depends on T009 from Foundational, so do sequentially)
Task T014: "Modify getNodeIcon in frontend/src/components/Node.tsx"
Task T017: "Add backend validation in src/mindflow/models/graph.py" (can be parallel)
```

---

## Parallel Example: User Story 2 Backend

```bash
# After tests are written and failing, launch backend models in parallel:
Task T041: "Create IconSuggestionRequest in src/mindflow/models/graph.py"
Task T042: "Create IconSuggestionResponse in src/mindflow/models/graph.py"

# After core endpoint (T046) is done, launch these in parallel:
Task T047: "Create /api/icons/registry endpoint in src/mindflow/api/routes/icons.py"
Task T048: "Create /api/icons/validate endpoint in src/mindflow/api/routes/icons.py"
```

---

## Implementation Strategy

### MVP First (User Stories 4 + 1 Only)

1. Complete Phase 1: Setup (T001-T005) - ~30 min
2. Complete Phase 2: Foundational (T006-T010) - ~2 hours
3. Complete Phase 3: User Story 4 (T011-T017) - ~2 hours
4. Complete Phase 4: User Story 1 (T018-T028) - ~3 hours
5. **STOP and VALIDATE**: Test full create/edit flow with manual icon selection
6. **MVP READY**: Users can select custom icons, icons display everywhere

**Estimated MVP Time**: ~8 hours

### Incremental Delivery

1. **Foundation** (Phases 1-2): Icon infrastructure → ~2.5 hours
2. **MVP** (Phases 3-4): Display + Manual Selection → +5 hours = 7.5 hours total
3. **Productivity** (Phase 5): Search & Favorites → +2 hours = 9.5 hours total
4. **Intelligence** (Phase 6): AI Suggestions → +3 hours = 12.5 hours total
5. **Production** (Phase 7): Polish & Testing → +2 hours = 14.5 hours total

**Each increment is independently deployable and adds user value**

### Parallel Team Strategy

With 2 developers:

1. **Foundation** (together): Phases 1-2 → 2.5 hours
2. **Parallel Split**:
   - Developer A: US4 (Display) → 2 hours
   - Developer B: US1 tests (T018-T021) → 2 hours
3. **Parallel Continue**:
   - Developer A: US1 implementation (T022-T028) → 3 hours
   - Developer B: US2 backend (T041-T049) → 3 hours
4. **Parallel Finish**:
   - Developer A: US3 (Search/Favorites) → 2 hours
   - Developer B: US2 frontend (T050-T056) → 2 hours
5. **Together**: Phase 7 (Polish) → 2 hours

**Team Time**: ~9.5 hours (vs 14.5 hours solo)

---

## Task Count Summary

- **Phase 1 (Setup)**: 5 tasks
- **Phase 2 (Foundational)**: 5 tasks
- **Phase 3 (US4 - Display)**: 7 tasks (3 tests + 4 implementation)
- **Phase 4 (US1 - Manual Selection)**: 11 tasks (4 tests + 7 implementation)
- **Phase 5 (US3 - Search/Favorites)**: 8 tasks (3 tests + 5 implementation)
- **Phase 6 (US2 - AI Suggestions)**: 20 tasks (4 tests + 16 implementation)
- **Phase 7 (Polish)**: 12 tasks

**Total**: 68 tasks

**Test Coverage**: 14 test tasks (20.6% of total) ensuring TDD workflow

**Parallel Opportunities**: 32 tasks marked [P] (47% can run in parallel with proper dependencies)

**MVP Scope**: 28 tasks (Phases 1-4) = 41% of total work delivers core value

---

## Notes

- [P] tasks = different files, no dependencies, can run in parallel
- [Story] label maps task to specific user story for traceability (US1, US2, US3, US4)
- Each user story is independently completable and testable
- TDD enforced: Tests written FIRST (RED phase), ensure FAIL, then implement (GREEN phase)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Icon registry (T009) is largest task: 500+ icons to map - consider breaking into chunks or automating
- Virtual scrolling (T023) critical for performance with 500+ icons
- AI suggestion caching (T056) improves UX and reduces API costs
- Favorites (localStorage) don't require backend - keeps feature lightweight
