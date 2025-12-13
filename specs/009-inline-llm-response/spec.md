# Feature Specification: Inline LLM Response Display

**Feature Branch**: `009-inline-llm-response`
**Created**: 2025-11-22
**Status**: Draft
**Input**: User description: "ce que je veux c'est que dans le node tu as la question et la réponse ... (en dessous en markdown) avec une scroll bar dans le node (tu dois pouvoir changer la taille du node ou des fonts si besoin) ... et ca dois se lancer quand tu crée le node pas besoin de faire ask llm (tu peux garder ask llm pour relancer au pire)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Inline Prompt Editing on Node Creation (Priority: P1)

When a node is created it must immediately enter inline edit mode with a focused multiline textarea so the user can type or adjust the prompt without any modal dialog.

**Why this priority**: The Antigravity plan defines inline editing as the default workflow. Hovering over separate dialogs or tools would slow creation and conflicts with "ce que je veux..." feedback.

**Independent Test**: Create a node -> verify textarea appears inside the node with focus -> verify typing updates prompt live -> verify double-click on an existing node also toggles edit mode without opening NodeEditor.

**Acceptance Scenarios**:

1. **Given** a user creates a node, **When** creation completes, **Then** the node enters edit mode with caret focus and no external dialog opens.
2. **Given** a node is viewed later, **When** the user double-clicks it, **Then** inline edit mode activates and properties dialog stays closed.
3. **Given** a user clicks outside the node while editing, **When** focus leaves, **Then** edit mode exits without triggering an LLM call.

---

### User Story 2 - Commit Shortcuts Launch Inline LLM (Priority: P1)

Users trigger the LLM inline by committing the prompt via Enter, Ctrl+Enter, or a Generate button; Shift+Enter inserts a newline. Once the commit action occurs, the LLM request auto-starts and streams into the node.

**Why this priority**: Eliminates the old "Ask LLM" friction for first drafts while keeping user control and aligning with the Antigravity shortcut workflow.

**Independent Test**: Enter prompt -> press Enter -> verify edit mode exits -> verify streaming starts within 200 ms -> verify Shift+Enter only adds newline.

**Acceptance Scenarios**:

1. **Given** a node is in edit mode, **When** the user presses Enter or Ctrl+Enter, **Then** the system exits edit mode and starts an LLM request tied to that node.
2. **Given** a node is in edit mode, **When** the user presses Shift+Enter, **Then** a newline is inserted and no request is fired.
3. **Given** a user clicks the Generate button, **When** it is pressed, **Then** the same LLM request lifecycle occurs as with the keyboard shortcut.
4. **Given** the user disabled auto-run-on-commit in settings, **When** Enter is pressed, **Then** the prompt is saved but no LLM call occurs until "Ask LLM" or Generate is invoked.

---

### User Story 3 - Dual-Pane Layout with Independent Scrollbars (Priority: P1)

Nodes render the editable prompt (top) and markdown-formatted response (bottom) with dedicated vertical scrollbars (`prompt_height`, `response_height`) and smooth scrolling that never resizes the textarea itself.

**Why this priority**: The Antigravity plan explicitly calls for "slider bars" on both prompt and response plus a premium markdown display to keep long text manageable.

**Independent Test**: Paste >1,000-character prompt and receive long response -> verify both panes show scrollbars when content exceeds configured heights -> verify markdown renders correctly with sanitization.

**Acceptance Scenarios**:

1. **Given** a long prompt, **When** it exceeds `prompt_height`, **Then** a scrollbar appears inside the textarea while the node dimensions remain fixed.
2. **Given** a long response, **When** it exceeds `response_height`, **Then** the response pane scrolls independently with preserved markdown styling.
3. **Given** malformed markdown or XSS content, **When** displayed, **Then** sanitizer strips dangerous HTML while keeping formatting.

---

### User Story 4 - Adaptive Resizing and Simplified View (Priority: P2)

Nodes provide corner resize handles that persist width/height, disable resizing while editing, and automatically collapse into a simplified summary view when width drops below 150 px. Double-clicking a collapsed node restores the full layout.

**Why this priority**: Inline editing makes node dimensions central to usability, and the Antigravity plan mandates an intelligent resize plus "mode simplifie".

**Independent Test**: Resize node to 140 px width -> verify simplified mode engages -> double-click simplified node -> verify expansion and data restore -> attempt to resize during edit mode -> verify handles disabled.

**Acceptance Scenarios**:

1. **Given** a node in view mode, **When** the user drags resize handles, **Then** width/height update and persist to the backend.
2. **Given** a node in edit mode, **When** the user attempts to drag handles, **Then** resizing is blocked until edit mode exits.
3. **Given** node width <150 px, **When** size change completes, **Then** simplified view renders a summary and double-clicking restores the full view.

---

### User Story 5 - Manual Regeneration & Properties Panel Separation (Priority: P2)

Users still access "Ask LLM"/"Regenerate" from the context menu, which cancels any in-flight request and restarts streaming, while the full properties dialog remains a dedicated context-menu action (never triggered by inline editing).

**Why this priority**: Maintains transparency, lets users intentionally re-run the model, and keeps Antigravity’s separation between inline editing and node metadata management.

**Independent Test**: Trigger "Ask LLM" from context menu during streaming -> verify previous request cancels -> confirm new streaming starts and response is replaced; select "Properties" -> verify the dialog opens even if inline edit mode exists.

**Acceptance Scenarios**:

1. **Given** streaming is active, **When** "Ask LLM" is chosen, **Then** the system cancels the operation, clears partial response, and restarts streaming.
2. **Given** a node, **When** the user chooses "Properties," **Then** the DetailPanel/NodeEditor opens for metadata editing without touching inline prompt mode.
3. **Given** a user double-clicks a node, **When** inline edit opens, **Then** the properties dialog does not appear unless explicitly requested via context menu.

---

### Edge Cases

- LLM provider unavailable or errors while exiting edit mode and auto-launching (retry/backoff vs. inline error message)
- Extremely long prompts/responses (>10 k chars) forcing simultaneous scrollbars and resize interactions
- Rapid creation of multiple nodes in edit mode (focus management, pending operations queue)
- Shift+Enter multiline prompts followed by accidental clicks (ensure no unwanted request fires)
- Node deletion during streaming or while simplified view active
- Network interruptions mid-stream and subsequent resume when revisiting the node
- Markdown with malformed syntax or XSS attempts
- Auto-collapse toggling when user repeatedly crosses the 150 px width threshold
- Empty or whitespace-only prompts (should block commit) and empty LLM responses (display "No response" state)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When a node is created, the UI MUST drop directly into inline edit mode with a focused multiline textarea inside the node.
- **FR-002**: Double-clicking a node MUST toggle inline edit mode, while the full properties dialog MUST only open from the context-menu "Properties/Edit Node" action.
- **FR-003**: Pressing Enter, Ctrl+Enter, or the Generate button MUST exit edit mode and launch an LLM request; Shift+Enter MUST insert a newline; clicking outside MUST exit edit mode without launching.
- **FR-004**: Once a commit action occurs, the system MUST automatically start streaming the response into the node without requiring "Ask LLM"; manual "Ask LLM" MUST remain available for later regenerations.
- **FR-005**: Prompt and response MUST render in distinct panes with independent vertical scrollbars whose heights are controlled via stored `prompt_height` and `response_height` values.
- **FR-006**: Response content MUST render via the Markdown renderer with sanitization, and prompt textarea MUST maintain `overflow-y: auto` instead of native resize handles.
- **FR-007**: Streaming state MUST be visible inside the node, and the user MUST be able to cancel or regenerate via context menu actions that clear the prior response before new content streams.
- **FR-008**: Nodes MUST expose resize handles, persist width/height updates, and temporarily disable resizing while inline edit mode is active.
- **FR-009**: When node width falls below 150 px the UI MUST switch to a simplified summary view, and double-clicking MUST restore the full pane; the simplified state MUST persist.
- **FR-010**: Nodes MUST persist layout preferences (`font_size`, `prompt_height`, `response_height`, `node_width`, `node_height`, simplified flag) together with question and response text.
- **FR-011**: Users MUST be able to adjust font size between 10 px and 24 px and see both prompt and response scale proportionally.
- **FR-012**: System MUST use stored LLM provider configuration (provider, model, system prompt, temperature) for every inline request.
- **FR-013**: LLM errors MUST display inline within the response pane (with retry guidance) within 3 seconds of failure detection.
- **FR-014**: Markdown content MUST be sanitized to prevent XSS attacks.
- **FR-015**: Partial streaming progress MUST be persisted so revisiting the node mid-stream shows accumulated content to date.

### Key Entities

- **LLM Node**: Canvas node combining inline prompt editing and streaming response
  - `prompt_text` (user-provided, multiline)
  - `llm_response` (markdown-formatted string)
  - `llm_operation_id` (tracks the in-flight request)
  - `font_size`
  - `node_width` / `node_height`
  - `prompt_height` / `response_height`
  - `is_simplified` (auto-collapse flag)
  - `last_edit_author` (human/llm/tool)

- **Inline Edit Session**:
  - `is_edit_mode`
  - `last_committed_at`
  - Pending prompt diff (used to decide whether to auto-launch)

- **LLM Configuration**: User preferences for inline operations
  - Provider (ollama/openai/anthropic/deepseek/...)
  - Model name
  - System prompt (optional)
  - Temperature and sampling params
  - Execution mode preference (auto-run on commit enabled/disabled)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Inline edit mode (with focused caret) appears within 150 ms after node creation or double-click.
- **SC-002**: Enter/Ctrl+Enter launch streaming within 200 ms of the keypress, while Shift+Enter never launches a request in 100% of tests.
- **SC-003**: Prompt and response scrollbars appear precisely when content exceeds `prompt_height`/`response_height`, with <1 frame of layout shift.
- **SC-004**: Markdown rendering passes 100% of sanitization tests across headings, lists, code blocks, links, and malicious HTML payloads.
- **SC-005**: Resize handle interactions apply dimension changes within 100 ms and simplified mode toggles within 500 ms of crossing the 150 px width threshold.
- **SC-006**: Font size adjustments across the 10–24 px range update both panes within 100 ms and persist after reload.
- **SC-007**: Inline error or retry messaging appears within 3 s of any provider failure, and manual regeneration cancels previous streams within 500 ms.
- **SC-008**: Partial streaming progress reloads within 300 ms when the node is revisited, even while the operation remains in-flight.
- **SC-009**: The UI remains responsive (scroll/jank <50 ms) with >=10 concurrent inline streams.
