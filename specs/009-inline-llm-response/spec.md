# Feature Specification: Inline LLM Response Display

**Feature Branch**: `009-inline-llm-response`
**Created**: 2025-11-22
**Status**: Draft
**Input**: User description: "ce que je veux c'est que dans le node tu as la question et la réponse ... (en dessous en markdown) avec une scroll bar dans le node (tu dois pouvoir changer la taille du node ou des fonts si besoin) ... et ca dois se lancer quand tu crée le node pas besoin de faire ask llm (tu peux garder ask llm pour relancer au pire)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Auto-Launch LLM on Node Creation (Priority: P1)

When a user creates a new node with question content, the system automatically launches an LLM operation to generate a response without requiring manual triggering.

**Why this priority**: This is the core user experience - automatic response generation is what differentiates this feature from manual LLM invocation. Without this, the feature loses its primary value proposition.

**Independent Test**: Create a node with question text → verify LLM starts automatically → verify response appears in node without any "Ask LLM" action.

**Acceptance Scenarios**:

1. **Given** user creates a new node with text content, **When** node creation completes, **Then** LLM operation starts automatically and response begins streaming into the node
2. **Given** LLM is generating a response, **When** user views the node, **Then** node displays both question (top) and streaming response (bottom) with clear visual separation
3. **Given** response generation is in progress, **When** user navigates away and returns, **Then** node shows accumulated response content so far

---

### User Story 2 - Question and Response Layout (Priority: P1)

Nodes display question text at the top and LLM-generated response below in markdown format, with automatic scrolling for long content.

**Why this priority**: This is the fundamental UI structure that makes responses readable and accessible. Without proper layout, users cannot effectively consume the generated content.

**Independent Test**: Generate a long response → verify question stays at top → verify response renders as markdown → verify scrollbar appears when content exceeds node height.

**Acceptance Scenarios**:

1. **Given** node contains question and response, **When** user views the node, **Then** question appears at top, response appears below with markdown formatting (headings, lists, code blocks, emphasis)
2. **Given** response content exceeds node visible area, **When** user views the node, **Then** scrollbar appears allowing vertical scrolling within the node
3. **Given** response contains markdown elements, **When** rendered, **Then** proper formatting is applied (bold, italic, lists, code blocks, links)

---

### User Story 3 - Manual Regeneration (Priority: P2)

Users can manually trigger LLM response regeneration using "Ask LLM" context menu option when they want to refresh or modify the response.

**Why this priority**: Provides control and flexibility for users who want different responses or need to regenerate after editing the question. Less critical than auto-launch but important for iterative workflows.

**Independent Test**: Right-click node with existing response → select "Ask LLM" → verify new LLM operation starts → verify old response is replaced with new one.

**Acceptance Scenarios**:

1. **Given** node has existing LLM-generated response, **When** user right-clicks node and selects "Ask LLM", **Then** system launches new LLM operation and replaces old response with new streaming content
2. **Given** user modifies question text in existing node, **When** user triggers "Ask LLM", **Then** system generates response based on updated question
3. **Given** LLM operation is in progress, **When** user triggers "Ask LLM" again, **Then** previous operation is cancelled and new one starts

---

### User Story 4 - Font and Node Size Adjustment (Priority: P3)

Users can adjust font size or node dimensions to improve readability of question and response content.

**Why this priority**: Enhances usability and accessibility but not essential for core functionality. Users can function without this if default sizes are reasonable.

**Independent Test**: Select node → use resize handles or font controls → verify content reflows appropriately → verify readability is improved.

**Acceptance Scenarios**:

1. **Given** node is selected, **When** user adjusts font size control, **Then** both question and response text scale proportionally
2. **Given** node is selected, **When** user drags resize handles, **Then** node dimensions change and content reflows to fit new size
3. **Given** content is being scrolled, **When** user resizes node, **Then** scroll position adapts appropriately to new dimensions

---

### Edge Cases

- What happens when LLM provider is unavailable or returns error during auto-launch?
- How does system handle very long questions (>10,000 characters)?
- What happens if user deletes node while LLM response is streaming?
- How does system handle markdown with malformed syntax or XSS attempts?
- What happens when user creates multiple nodes rapidly (5+ nodes in quick succession)?
- How does system handle network interruption during streaming?
- What happens if LLM returns empty response?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST automatically initiate LLM operation when node is created with text content
- **FR-002**: System MUST display question text at the top of the node
- **FR-003**: System MUST display LLM response below question text with markdown rendering
- **FR-004**: System MUST provide vertical scrollbar when response content exceeds node visible height
- **FR-005**: System MUST stream response content incrementally as it arrives from LLM
- **FR-006**: System MUST preserve existing "Ask LLM" context menu option for manual regeneration
- **FR-007**: System MUST cancel previous LLM operation when new "Ask LLM" is triggered on same node
- **FR-008**: System MUST use stored LLM provider configuration (provider, model, system prompt) from user settings
- **FR-009**: System MUST allow font size adjustment for node content
- **FR-010**: System MUST allow node dimension adjustment via resize handles
- **FR-011**: System MUST handle LLM errors gracefully by displaying error message in response area
- **FR-012**: System MUST sanitize markdown content to prevent XSS attacks
- **FR-013**: System MUST persist both question and response content when node is saved

### Key Entities

- **LLM Node**: Canvas node containing user question and LLM-generated response
  - Question text (user-provided)
  - Response text (LLM-generated, markdown-formatted)
  - LLM operation ID (tracks active generation)
  - Font size preference
  - Node dimensions

- **LLM Configuration**: User preferences for LLM operations
  - Provider (ollama/openai/anthropic/deepseek)
  - Model name
  - System prompt (optional)
  - Temperature and other parameters

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can create nodes and see LLM responses appear automatically within 2 seconds of node creation
- **SC-002**: Markdown-formatted responses render correctly 100% of the time for standard markdown syntax (headings, lists, code blocks, emphasis)
- **SC-003**: Scrollbar appears and functions correctly when response exceeds 300 pixels in height
- **SC-004**: Font size adjustments scale text smoothly across range of 10px to 24px
- **SC-005**: Node resize operations complete within 100ms with smooth content reflow
- **SC-006**: 95% of users successfully read and interact with LLM responses without manual intervention
- **SC-007**: Error messages appear within 3 seconds when LLM operations fail
- **SC-008**: System handles 10+ concurrent LLM streaming operations without UI lag or freezing
