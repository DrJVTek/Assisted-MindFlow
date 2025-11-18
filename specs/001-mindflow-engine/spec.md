# Feature Specification: MindFlow Engine (Speckit)

**Feature Branch**: `001-mindflow-engine`
**Created**: 2025-11-17
**Status**: Draft
**Input**: AI-assisted visual reasoning engine based on graph nodes (MindMap) with centralized LLM management and optional automatic orchestration

## User Scenarios & Testing

### User Story 1 - Create and Navigate Reasoning Graph (Priority: P1)

Users can create a visual reasoning graph by adding nodes (questions, answers, notes, hypotheses) and connecting them in a parent-child relationship. Users navigate through the graph visually to explore different reasoning paths and see how ideas connect and evolve.

**Why this priority**: This is the core value proposition - enabling visual thought organization. Without this, the system has no foundation.

**Independent Test**: User can create at least 5 nodes of different types, connect them with parent-child relationships, and view the resulting graph structure. Delivers immediate value as a digital thinking canvas.

**Acceptance Scenarios**:

1. **Given** an empty project, **When** user creates a new node with type "question" and content "How can we improve user engagement?", **Then** the node appears in the graph with a unique ID
2. **Given** an existing node A, **When** user creates a child node B and links it to A, **Then** node B shows A as parent and A shows B as child
3. **Given** multiple connected nodes, **When** user views the graph, **Then** all nodes and their connections are displayed with clear visual hierarchy
4. **Given** existing nodes, **When** user manually recables a node to have different parents, **Then** the graph updates to reflect new relationships

---

### User Story 2 - Add Comments and Annotations (Priority: P2)

Users can add comments to any node to provide additional context, feedback, or notes without modifying the main node content. Comments are displayed alongside nodes and can be authored by humans or AI.

**Why this priority**: Essential for collaboration and iterative refinement. Enables non-destructive feedback similar to code review comments.

**Independent Test**: User can add 3 comments to different nodes, view them attached to those nodes, and see author attribution. Delivers value as annotation system.

**Acceptance Scenarios**:

1. **Given** an existing node, **When** user adds a comment "This needs more detail", **Then** the comment is attached to the node with timestamp and author
2. **Given** a node with comments, **When** user views the node, **Then** all comments are visible in chronological order
3. **Given** multiple nodes with comments, **When** AI generates a response, **Then** AI can add comments to relevant nodes

---

### User Story 3 - Organize with Groups and Projects (Priority: P1)

Users can organize nodes into hierarchical groups (projects, clusters, subgroups) to manage complexity. A project is a reusable collection of nodes that can be imported into other projects, with stop nodes serving as output points.

**Why this priority**: Critical for managing complex reasoning graphs and enabling reusability. Without organization, graphs become unwieldy quickly.

**Independent Test**: User can create a project with 2 subgroups, assign nodes to groups, mark stop nodes, and reuse that project as a group in another project. Delivers value as organization system.

**Acceptance Scenarios**:

1. **Given** a new workspace, **When** user creates a group of kind "project" with label "Market Analysis", **Then** the project appears as a root-level container
2. **Given** an existing project, **When** user creates a subgroup "Customer Segments" within it, **Then** the subgroup appears nested under the project
3. **Given** nodes in a project, **When** user marks a node as stop=true, **Then** that node is designated as an output/exit point for that reasoning path
4. **Given** a completed project with stop nodes, **When** user imports it as a group into another project, **Then** the stop nodes serve as entry points for results

---

### User Story 4 - AI-Assisted Reasoning with LLM Integration (Priority: P1)

Users can ask questions or request assistance from AI assistants (Claude, GPT, local models) that analyze the graph context and respond with both human-readable text and graph operations (create nodes, add links, create groups).

**Why this priority**: The "assisted" in "AI-assisted reasoning" - this is what differentiates the system from a static mindmap tool.

**Independent Test**: User can select an LLM provider, ask a question in context of existing nodes, and receive both a text response and automatic graph updates. Delivers immediate AI value.

**Acceptance Scenarios**:

1. **Given** configured LLM providers, **When** user requests available providers, **Then** system lists Claude, OpenAI, Mistral, Groq, and local options with their capabilities
2. **Given** an active LLM provider, **When** user asks "What are the risks of this approach?" on a specific node, **Then** AI responds with analysis text and creates new hypothesis nodes linked to the original
3. **Given** AI generating a response, **When** AI returns graph_actions in JSON format, **Then** system executes those operations (CREATE_NODE, LINK, CREATE_GROUP, etc.) automatically
4. **Given** multiple LLM providers configured, **When** user switches active provider, **Then** subsequent AI calls use the newly selected provider

---

### User Story 5 - Context-Aware AI Responses (Priority: P2)

The system automatically selects relevant nodes as context for AI calls using different strategies (timeline, graph neighborhood, group context, manual override). Users can choose summarization approaches (temporal, weighted, path-based, hybrid) to optimize token usage.

**Why this priority**: Improves AI response quality by providing relevant context. Essential for maintaining coherence in complex graphs.

**Independent Test**: User can select "GraphNeighborhood" context strategy and "HybridSummary" approach, then request AI analysis on a node. System provides context from parents, children, and siblings within token budget. Delivers smarter AI responses.

**Acceptance Scenarios**:

1. **Given** a node with 3 parents and 5 children, **When** user requests AI analysis with "GraphNeighborhood" context, **Then** system includes parent, child, and sibling nodes in the context
2. **Given** a large group with 50 nodes, **When** user selects "GroupContext" with "HybridSummary", **Then** system summarizes group content to fit within token limits
3. **Given** explicit node selection, **When** user chooses "ManualOverride" context strategy, **Then** system uses only user-selected nodes as context
4. **Given** recent node activity, **When** user selects "TemporalSummary", **Then** system prioritizes recently created/updated nodes in context

---

### User Story 6 - Automatic Orchestration and Exploration (Priority: P3)

Users can optionally enable automatic orchestration on a group, causing the system to automatically generate multiple hypotheses, create evaluation nodes, explore reasoning paths in parallel, and organize results into subgroups until stopping conditions are met.

**Why this priority**: Advanced feature for power users. Valuable but not essential for core functionality. Can be added after foundation is stable.

**Independent Test**: User enables auto mode on a group with parameters (maxDepth=3, BreadthFirst exploration), system generates hypothesis nodes, evaluates them, creates summary nodes, and marks stop nodes when complete. Delivers automated exploration value.

**Acceptance Scenarios**:

1. **Given** a project with auto mode disabled (default), **When** user explicitly enables orchestration on a group, **Then** system begins generating hypothesis nodes from the starting point
2. **Given** orchestration running in BreadthFirst mode, **When** system explores the graph, **Then** it creates hypothesis nodes at each level before going deeper
3. **Given** orchestration generating nodes, **When** maxNodesPerPass limit is reached, **Then** system pauses and waits for user review
4. **Given** multiple exploration paths, **When** system evaluates hypotheses, **Then** it creates evaluation nodes with status "valid" or "invalid" and stops exploring invalid paths
5. **Given** orchestration reaching maxDepth, **When** exploration completes, **Then** system marks final nodes with stop=true and generates summary nodes per subgroup

---

### User Story 7 - Merge and Synthesize Nodes (Priority: P2)

Users can select multiple nodes and merge them into a single synthesis node (question or summary type). AI can optionally provide automatic synthesis suggestions based on the content of merged nodes.

**Why this priority**: Key for consolidating insights and reducing graph complexity as reasoning progresses. Important workflow feature.

**Independent Test**: User selects 3 related hypothesis nodes, requests merge with AI synthesis, receives a new summary node that captures key points from all three. Delivers consolidation value.

**Acceptance Scenarios**:

1. **Given** 3 selected nodes with related content, **When** user executes MERGE_NODES operation with objective "Consolidate user feedback", **Then** system creates a new summary node linking to all 3 sources
2. **Given** nodes being merged, **When** user requests AI synthesis, **Then** AI analyzes merged node content and generates synthesized summary text
3. **Given** successful merge, **When** new synthesis node is created, **Then** original nodes remain in graph with connections preserved

---

### Edge Cases

- What happens when a node has no parents (orphan root nodes)?
  - System allows orphan nodes as valid starting points for new reasoning threads
- What happens when circular dependencies are created (node A → B → C → A)?
  - System detects cycles and warns user before creating circular references
- What happens when an LLM provider is unavailable or times out?
  - System retries based on configured retry count, then falls back to error message and allows user to try different provider
- What happens when orchestration generates too many nodes too quickly?
  - System respects maxNodesPerPass and pauses for user review before continuing
- What happens when importing a project as a group creates ID conflicts?
  - System generates new UUIDs for imported nodes and maintains internal references
- What happens when a group hierarchy becomes deeply nested (10+ levels)?
  - System allows arbitrary depth but UI should warn about complexity
- What happens when context selection exceeds token budget even with aggressive summarization?
  - System truncates context to fit budget, prioritizing most recent/important nodes based on strategy
- What happens when user attempts to delete a node with many children?
  - System warns about impact and optionally offers to recable children to deleted node's parents

## Requirements

### Functional Requirements

#### LLM Management

- **FR-001**: System MUST provide unified interface to manage multiple LLM providers (Claude, OpenAI, Mistral, Groq, llama.cpp, Ollama, others)
- **FR-002**: System MUST support operations: listProviders(), setActiveProvider(providerId), generate(prompt, settings), embed(text[]), getCapabilities(providerId)
- **FR-003**: System MUST allow configuration of generation parameters: temperature, top_p, top_k, penalties, max_tokens, timeout, retries, token budget
- **FR-004**: System MUST support both online (API-based) and offline (local model) LLM providers
- **FR-005**: System MUST persist provider configuration across sessions

#### Graph Data Model

- **FR-006**: System MUST support Node entities with: UUID id, type (question|answer|note|hypothesis|evaluation|summary|plan|group_meta|comment|stop), author (human|llm|tool), content string, parent/child node arrays, group membership array, metadata (timestamps, importance 0-1, tags, status, stop flag)
- **FR-007**: System MUST support Group entities with: UUID id, label, kind (project|cluster|subgroup|generated|auto), optional parent group, metadata (color, pinned nodes, timestamps, tags)
- **FR-008**: System MUST support Comment entities with: UUID id, author, content, attachedTo (NodeID or EdgeID), timestamp
- **FR-009**: System MUST treat projects as Groups with kind="project" serving as root containers
- **FR-010**: System MUST allow hierarchical group nesting (groups within groups) to arbitrary depth
- **FR-011**: System MUST persist graph data (nodes, groups, comments, relationships) durably

#### Graph Operations

- **FR-012**: System MUST support CREATE_NODE(type, content, parents[], groups[], meta?) operation
- **FR-013**: System MUST support UPDATE_NODE(id, content?, meta?) operation
- **FR-014**: System MUST support LINK(parentId, childId) operation to create relationships
- **FR-015**: System MUST support DELETE_NODE(id) operation with safeguards against orphaning child nodes
- **FR-016**: System MUST support ADD_COMMENT(nodeId, content) operation
- **FR-017**: System MUST support CREATE_GROUP(label, kind, parentGroup?) operation
- **FR-018**: System MUST support ADD_NODE_TO_GROUP(nodeId, groupId) and REMOVE_NODE_FROM_GROUP(nodeId, groupId) operations
- **FR-019**: System MUST support MERGE_GROUPS(sourceGroupIds[], targetLabel) operation
- **FR-020**: System MUST support MERGE_NODES(nodeIds[], objective) operation creating synthesis nodes
- **FR-021**: System MUST support FORK_FROM(nodeId, question) operation creating child question nodes
- **FR-022**: System MUST support SET_STOP(nodeId) operation marking nodes as exit points
- **FR-023**: System MUST support RECABLE_NODE(nodeId, newParents[]) operation for manual rewiring

#### Context Engine

- **FR-024**: System MUST implement context selection strategies: Timeline, GraphNeighborhood, GroupContext, ManualOverride
- **FR-025**: System MUST implement summarization types: GlobalSummary, TemporalSummary, WeightedSummary, GroupSummary, PathSummary, HybridSummary
- **FR-026**: System MUST respect token budget limits when building context for LLM calls
- **FR-027**: System MUST select relevant nodes for context based on chosen strategy and current focus node/group
- **FR-028**: System MUST weight node importance using metadata.importance values when using WeightedSummary
- **FR-029**: System MUST prioritize recent nodes when using TemporalSummary based on created_at/updated_at timestamps

#### AI Integration and Response Handling

- **FR-030**: System MUST send context-enriched prompts to active LLM provider
- **FR-031**: System MUST expect AI responses in format: {reply: string, graph_actions: [{op, params}]}
- **FR-032**: System MUST execute graph_actions returned by AI automatically
- **FR-033**: System MUST display reply text to user as AI's human-readable response
- **FR-034**: System MUST handle AI errors gracefully (timeout, invalid response, API errors) without corrupting graph state

#### Automatic Orchestration

- **FR-035**: Orchestration MUST be disabled by default for all groups
- **FR-036**: System MUST allow explicit user activation of orchestration per group
- **FR-037**: When orchestration is active, system MUST generate multiple hypothesis nodes from starting point
- **FR-038**: Orchestration MUST create automatic subgroups (kind="generated" or "auto") for exploration branches
- **FR-039**: Orchestration MUST create evaluation, summary, and stop nodes as exploration progresses
- **FR-040**: Orchestration MUST support exploration modes: BreadthFirst, DepthFirst, Heuristic, Temporal
- **FR-041**: Orchestration MUST respect stopping conditions: maxNodesPerPass, maxDepth, timeBudget, minimum confidence threshold
- **FR-042**: System MUST allow user to pause, resume, or cancel orchestration at any time

#### Project Reusability

- **FR-043**: System MUST allow any project (Group with kind="project") to be imported as a group into another project
- **FR-044**: When importing project as group, system MUST expose nodes with stop=true as output/result entry points
- **FR-045**: Imported project nodes MUST maintain their internal relationships within the imported group
- **FR-046**: System MUST generate new UUIDs for imported nodes to avoid ID conflicts

#### Manual Interactions

- **FR-047**: Users MUST be able to manually add comments to any node
- **FR-048**: Users MUST be able to manually recable nodes (change parent relationships)
- **FR-049**: Users MUST be able to manually merge nodes into synthesis nodes
- **FR-050**: Users MUST be able to request AI-assisted synthesis during merge operations

### Key Entities

- **Node**: Represents a discrete unit of thought/reasoning with typed content (question, answer, hypothesis, etc.), authorship, relationships to other nodes, group membership, and rich metadata including importance scoring and status tracking
- **Group**: Hierarchical container for organizing related nodes, supporting arbitrary nesting, visual customization, and special semantics for projects as root containers
- **Comment**: Non-invasive annotation attached to nodes or edges for feedback, notes, or discussion without modifying core content
- **Project**: Special group serving as root-level workspace, reusable as imported subgraph in other projects with stop nodes as interfaces
- **Edge/Link**: Directional parent-child relationship between nodes forming graph structure
- **Context**: Dynamically computed collection of relevant nodes used as input for LLM calls, built using strategy and summarization settings
- **Graph Operation**: Atomic command modifying graph state (create, update, link, delete, merge, etc.)
- **LLM Provider**: Configured AI model endpoint (online API or local instance) with capabilities and generation parameters

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can create and visualize a reasoning graph with 50+ nodes and navigate through it without performance degradation
- **SC-002**: Users can switch between 3+ different LLM providers within 5 seconds
- **SC-003**: AI response including graph updates completes within 10 seconds for contexts under 8000 tokens
- **SC-004**: 90% of user requests to merge nodes result in successful synthesis node creation
- **SC-005**: Automatic orchestration can explore reasoning space and generate 20+ hypothesis nodes within 2 minutes
- **SC-006**: Context engine reduces token usage by 40% compared to including all nodes, while maintaining response relevance
- **SC-007**: Users can import a 30-node project as a group into another project within 3 seconds
- **SC-008**: System handles graphs with 100+ nodes and 200+ edges without UI lag
- **SC-009**: Manual recabling operations reflect in UI within 1 second
- **SC-010**: Comments are visible immediately upon creation with correct author attribution

## Assumptions

- Users have basic familiarity with mindmapping or graph-based tools
- LLM providers require API keys or local model setup handled outside this system
- Users understand that AI-generated content requires human review and validation
- Graph storage uses standard file formats or databases (not specified in requirements)
- UI exists separately and communicates with this engine via defined interfaces
- Users will primarily work with graphs of 10-200 nodes for most use cases
- Network connectivity is required for online LLM providers
- Local LLM providers (llama.cpp, Ollama) are installed and configured separately
- JSON format for graph operations is standard and parseable
- Users can manually stop runaway orchestration if needed

## Scope

### In Scope

- Core graph data model (nodes, groups, comments, edges)
- All graph operations (create, update, delete, link, merge, recable, etc.)
- Unified LLM provider interface and management
- Context engine with multiple selection strategies and summarization types
- AI response parsing and automatic graph operation execution
- Optional automatic orchestration with configurable exploration modes
- Project import/export and reusability
- Manual node manipulation (comments, recabling, merging)
- Stop nodes as exit points and interfaces
- Hierarchical group organization

### Out of Scope

- User interface implementation (UI is separate concern)
- Authentication and user management
- Real-time collaboration between multiple users
- Version control and graph history/undo beyond basic operations
- LLM provider API implementation (uses existing provider APIs)
- Local LLM installation and configuration
- Graph visualization rendering (handled by UI layer)
- Data export to external formats (PDF, image, etc.)
- Search and filtering across nodes (may be future enhancement)
- Performance optimization for graphs with 1000+ nodes (not initial target)
- Mobile-specific features or native apps

## Dependencies

- LLM provider APIs (Claude, OpenAI, Mistral, Groq, etc.) must be accessible
- Local LLM runtimes (llama.cpp, Ollama) must be installed separately if used
- JSON parsing library for handling graph operations
- UUID generation library for node/group IDs
- Data persistence layer (file system or database) must be available
- UI layer must implement calls to this engine's interface

## Constraints

- Token budget limits for LLM calls may restrict context size
- API rate limits from LLM providers may throttle AI-assisted operations
- Local LLM performance depends on hardware capabilities
- Graph complexity may impact rendering performance in UI layer
- Automatic orchestration costs accumulate based on LLM provider pricing
- Circular dependency detection adds overhead to LINK operations
- Deep group nesting may impact query performance
