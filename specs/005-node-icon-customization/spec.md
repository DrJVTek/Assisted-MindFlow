# Feature Specification: Node Icon Customization

**Feature Branch**: `005-node-icon-customization`
**Created**: 2025-11-21
**Status**: Draft
**Input**: User description: "il y a une gestion d'icon (visuel) sur le la dialog de prompt llm mais ca ne semble pas modifiable dans l'interface : verifier et rajouter la gestion au moment de la création du prompt (ou assigantion par l'ia de facon automatique de l'icon en fonction du prompt)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Manual Icon Selection on Node Creation (Priority: P1)

Users need to choose visual icons when creating nodes to better organize their reasoning graphs with personalized visual markers. Currently icons are automatically assigned based on node type and cannot be customized.

**Why this priority**: Core UX improvement - users want visual customization during node creation to match their mental model, not system-assigned icons.

**Independent Test**: User creates a new node, sees icon selector with available icons from lucide-react library, selects desired icon, and node is created with chosen icon persisted.

**Acceptance Scenarios**:

1. **Given** user creates a new node, **When** node creation dialog opens, **Then** icon selector UI appears with default icon pre-selected based on node type
2. **Given** user clicks icon selector, **When** icon picker opens, **Then** grid of available icons is displayed organized by category (communication, objects, symbols, etc.)
3. **Given** user selects a different icon from picker, **When** they click an icon, **Then** icon picker closes and selected icon appears in the preview
4. **Given** user has selected custom icon, **When** they save the node, **Then** node is created with custom icon persisted in metadata
5. **Given** user edits existing node, **When** edit dialog opens, **Then** current icon is displayed and can be changed
6. **Given** user creates node without selecting icon, **When** they save, **Then** default icon based on node type is assigned automatically

---

### User Story 2 - AI-Powered Icon Suggestion (Priority: P2)

AI automatically suggests appropriate icons based on node content/type when users create or edit nodes. This saves time and provides smart defaults while allowing manual override.

**Why this priority**: Enhances UX by reducing decision fatigue - AI suggests contextual icons but users can still override. Requires P1 (manual selection) infrastructure first.

**Independent Test**: User creates node with content "What are the key performance metrics?", AI suggests chart/analytics icon, user can accept suggestion or choose different icon.

**Acceptance Scenarios**:

1. **Given** user creates node with content, **When** AI processes content, **Then** suggested icon appears with visual indicator showing it's AI-suggested
2. **Given** AI suggests icon, **When** user reviews suggestion, **Then** option to accept or choose different icon is available
3. **Given** AI suggestion is accepted, **When** node is saved, **Then** suggested icon is persisted with metadata indicating AI suggestion
4. **Given** node content changes during editing, **When** user clicks "Suggest Icon", **Then** AI re-analyzes content and provides new suggestion
5. **Given** AI cannot determine appropriate icon, **When** suggestion fails, **Then** default type-based icon is shown with no AI indicator
6. **Given** user has AI suggestions enabled, **When** bulk creating nodes, **Then** all nodes receive AI-suggested icons automatically

---

### User Story 3 - Icon Search and Favorites (Priority: P3)

Users can search for icons by name/keyword and mark frequently used icons as favorites for quick access. This improves efficiency when working with large icon libraries.

**Why this priority**: Nice-to-have productivity feature - helpful for power users but not essential for basic functionality.

**Independent Test**: User searches for "chart", sees filtered icon results, selects favorite icons, and favorites appear at top of icon picker in future uses.

**Acceptance Scenarios**:

1. **Given** user opens icon picker, **When** they type in search box, **Then** icons are filtered in real-time matching search keywords
2. **Given** user searches "message", **When** results are displayed, **Then** all communication-related icons appear
3. **Given** user finds useful icon, **When** they click star/heart button, **Then** icon is added to favorites list
4. **Given** user has favorited icons, **When** icon picker opens, **Then** favorites section appears at top of picker
5. **Given** user wants to remove favorite, **When** they click starred icon again, **Then** icon is removed from favorites
6. **Given** no search results found, **When** user searches invalid term, **Then** helpful message suggests browsing categories or clearing search

---

### User Story 4 - Icon Preview in Node List and Canvas (Priority: P1)

Custom icons are displayed consistently throughout the application - in node cards, canvas visualization, node lists, and history panels. Users can visually identify nodes by their custom icons.

**Why this priority**: Essential for feature value - custom icons are useless if not displayed everywhere nodes appear.

**Independent Test**: User assigns custom icon to node, navigates to canvas view, node list, and history panel, and custom icon appears correctly in all locations.

**Acceptance Scenarios**:

1. **Given** node has custom icon, **When** displayed on canvas, **Then** custom icon appears instead of default type-based icon
2. **Given** node has custom icon, **When** shown in node list/search results, **Then** custom icon is displayed next to node content
3. **Given** node has custom icon, **When** viewed in version history, **Then** custom icon appears for all versions of that node
4. **Given** node has no custom icon (uses default), **When** displayed anywhere, **Then** type-based default icon appears
5. **Given** custom icon fails to load, **When** rendering node, **Then** fallback to default type-based icon with error logged
6. **Given** multiple nodes with same custom icon, **When** displayed together, **Then** all show the same custom icon correctly

---

### Edge Cases

- What happens when custom icon is deleted from icon library after being assigned to nodes?
  - System should fallback to default type-based icon and log warning about missing icon
- How does system handle very large icon sets (500+ icons)?
  - Icon picker should use virtualization to render only visible icons for performance
- What happens when AI suggestion service is unavailable/fails?
  - System should gracefully fallback to default type-based icons without blocking node creation
- How does system handle icon assignment for bulk node operations?
  - Batch icon assignment should support "Apply icon to all selected nodes" option
- What happens when importing graphs with custom icons from different icon libraries?
  - System should attempt to map icon names, fallback to default if not found, and provide import report
- How does system handle custom icon accessibility for screen readers?
  - Icon metadata should include alt text, and screen readers should announce icon name/description

## Requirements *(mandatory)*

### Functional Requirements

#### Icon Selection UI

- **FR-001**: System MUST provide icon selector UI component in node creation/edit dialogs
- **FR-002**: Icon selector MUST display preview of currently selected icon
- **FR-003**: Icon picker MUST show available icons in categorized grid layout (communication, objects, symbols, etc.)
- **FR-004**: Icon picker MUST use lucide-react icon library as source of available icons
- **FR-005**: Users MUST be able to click an icon to select it
- **FR-006**: Icon selector MUST support keyboard navigation (arrow keys, enter to select)
- **FR-007**: Icon picker MUST close automatically after selection or on outside click

#### Icon Storage & Persistence

- **FR-008**: System MUST add `custom_icon` field to NodeMetadata type (optional string storing lucide icon name)
- **FR-009**: System MUST persist custom icon selection in node metadata when node is saved
- **FR-010**: Backend MUST validate custom icon names against allowed icon set
- **FR-011**: System MUST maintain backward compatibility - existing nodes without custom icons use type-based defaults
- **FR-012**: System MUST include custom icon in node JSON export/import operations

#### Icon Display & Rendering

- **FR-013**: Node component MUST render custom icon if present in metadata, otherwise default type-based icon
- **FR-014**: System MUST display custom icons in all node representations (canvas, lists, history, search results)
- **FR-015**: System MUST provide fallback to default icon if custom icon fails to render
- **FR-016**: System MUST maintain consistent icon sizing (18px for node type icons, 14px for author icons)
- **FR-017**: System MUST apply same visual styling (strokeWidth, color) to custom icons as default icons

#### AI Icon Suggestion

- **FR-018**: System MUST provide AI endpoint for icon suggestion based on node content and type
- **FR-019**: AI MUST analyze node content keywords and semantic meaning to suggest relevant icon
- **FR-020**: AI suggestion MUST return icon name from lucide-react library
- **FR-021**: System MUST display AI-suggested icon with visual indicator (e.g., "AI suggested" badge)
- **FR-022**: Users MUST be able to accept or reject AI suggestions
- **FR-023**: System MUST log AI suggestion metadata (suggested icon, acceptance/rejection) for improvement
- **FR-024**: AI suggestion MUST complete within 2 seconds or fallback to default

#### Icon Search & Favorites

- **FR-025**: Icon picker MUST provide search input for filtering icons by name or keyword
- **FR-026**: Search MUST filter icons in real-time as user types
- **FR-027**: Users MUST be able to mark icons as favorites (star/heart button)
- **FR-028**: System MUST persist user's favorite icons in user preferences/local storage
- **FR-029**: Favorites section MUST appear at top of icon picker for quick access
- **FR-030**: Users MUST be able to remove icons from favorites

### Key Entities

- **Custom Icon Metadata**: Extension to NodeMetadata
  - `custom_icon` (string | null): Name of lucide-react icon (e.g., "heart", "star", "database")
  - `icon_source` ('default' | 'user' | 'ai'): How icon was assigned
  - `ai_suggested_icon` (string | null): Icon suggested by AI (stored for analytics)
  - `icon_assigned_at` (ISO 8601 datetime): When custom icon was assigned

- **Icon Picker State**: UI component state
  - Available icons list (grouped by category)
  - Search query string
  - Selected icon name
  - Favorites list (persisted per user)
  - AI suggestion (if available)

- **AI Icon Suggestion Request**: API request to LLM
  - Node type (question, answer, hypothesis, etc.)
  - Node content (first 500 chars for context)
  - Current icon (for refinement suggestions)
  - Response: Suggested icon name + confidence score

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can select custom icon during node creation in under 10 seconds
- **SC-002**: Custom icons persist and display correctly in 100% of cases across all UI components
- **SC-003**: AI suggests contextually relevant icons with 80%+ user acceptance rate
- **SC-004**: Icon picker renders 500+ icons with no performance degradation (60fps scrolling)
- **SC-005**: Search filters icons to relevant results in under 200ms for 95% of queries
- **SC-006**: 90% of users successfully customize node icons on first attempt without help
- **SC-007**: Custom icon feature adds less than 50KB to bundle size
- **SC-008**: Icon fallback mechanism prevents UI breaks in 100% of error cases
- **SC-009**: Backward compatibility - existing graphs load without errors with type-based icons
- **SC-010**: Icon accessibility - screen readers announce icon names for 100% of custom icons

### Qualitative Outcomes

- Users feel their reasoning graphs are more personalized and easier to navigate visually
- Power users appreciate icon search and favorites for workflow efficiency
- AI suggestions feel helpful and save time, not intrusive or incorrect
- Icon customization feels natural and integrated, not bolted-on

## Assumptions *(optional)*

- Users are familiar with icon selection patterns from other applications (emoji pickers, icon libraries)
- lucide-react icon library provides sufficient variety for reasoning graph use cases
- Node metadata can accommodate additional fields without schema migration issues
- AI icon suggestion can be implemented using existing LLM infrastructure
- Most users will use AI suggestions or defaults rather than manually selecting every icon
- Icon names in lucide-react are stable and won't be renamed frequently

## Dependencies *(optional)*

- **External Dependencies**:
  - lucide-react icon library (already in use)
  - LLM service for AI icon suggestions (already available)

- **Internal Dependencies**:
  - NodeMetadata schema update (frontend and backend)
  - Node component rendering logic (already implemented in Node.tsx)
  - Node creation/edit dialogs (need to add icon selector UI)

## Out of Scope *(optional)*

- Custom icon upload (users cannot upload their own SVG/PNG icons, only select from lucide-react)
- Icon animation or dynamic icons (static icons only)
- Icon color customization beyond node's existing color scheme
- Team/workspace-level icon sharing or presets
- Icon usage analytics dashboard (logged for future analysis, not displayed)
- Third-party icon library integration (lucide-react only)
- Icon versioning or history tracking (only current icon stored)
- Bulk icon assignment across multiple graphs

## Notes *(optional)*

### Technical Context

Currently, node icons are hardcoded in `frontend/src/components/Node.tsx` using the `getTypeIcon()` function which maps NodeType to lucide-react icon components. This works well for default behavior but prevents user customization.

The `NodeMetadata` interface in `frontend/src/types/graph.ts` does not include any icon-related fields, so a schema extension is required.

### User Experience Considerations

- Icon selector should feel lightweight and fast - no full-screen modals for simple icon selection
- AI suggestions should be subtle and non-intrusive - helpful hints, not forced choices
- Favorites should sync across sessions (localStorage or user preferences backend)
- Icon categories help users browse when they don't know exact icon name
- Default behavior should remain unchanged for users who don't want customization

### Design Patterns

- Icon picker UI can follow patterns from Slack emoji picker or Notion icon selector
- AI suggestion could use small inline badge "✨ AI suggests: [icon]" with accept/reject buttons
- Search should support fuzzy matching (searching "msg" finds "message", "mail", etc.)

### Future Enhancements (Not in Initial Scope)

- Icon themes or style variations (outline vs. filled icons)
- Custom icon upload and management
- Icon macros or templates for common node patterns
- Icon-based filtering and search in canvas view
- Icon accessibility improvements (high contrast mode, colorblind-friendly)
- Icon animation on node state changes (e.g., processing, completed)
