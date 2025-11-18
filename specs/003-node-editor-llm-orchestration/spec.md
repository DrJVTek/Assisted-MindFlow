# Feature Specification: Node Editor & LLM Orchestration

**Feature Branch**: `003-node-editor-llm-orchestration`
**Created**: 2025-11-18
**Status**: Draft - Requested by user
**Dependencies**: Feature 002 (Canvas Interface), Feature 001 (MindFlow Engine)

## Executive Summary

This feature adds **interactive editing** and **LLM orchestration** to the node canvas. Users can create new graphs, add/edit/delete nodes, enter LLM prompts, and trigger automated reasoning workflows. When a node is modified mid-chain, all downstream nodes are regenerated while preserving version history.

**Critical Gap Identified**: Feature 002 only provides READ-ONLY visualization. This feature adds the WRITE/EXECUTE capabilities.

---

## User Scenarios & Testing

### User Story 1 - Create New Graph and Add Nodes (Priority: P0)

**As a user**, I want to create a new reasoning graph and add nodes with my initial prompts/questions, **so that** I can start a new reasoning session.

**Acceptance Scenarios**:

1. **Given** I'm on the canvas interface, **When** I click "New Graph", **Then** a blank canvas opens with a graph ID assigned
2. **Given** a blank canvas, **When** I right-click empty space and select "Add Node", **Then** a node creation dialog appears
3. **Given** the node creation dialog, **When** I select type "question" and enter prompt "What is the best approach?", **Then** a new question node appears on canvas with my prompt
4. **Given** an existing node, **When** I right-click it and select "Add Child Node", **Then** a connected child node is created
5. **Given** a new node, **When** I save it, **Then** it's persisted via API POST /api/graphs/{id}/nodes

**UI Requirements**:
- "New Graph" button in top-left toolbar
- Context menu on right-click (canvas and nodes)
- Node creation modal with fields:
  - Type dropdown (question, answer, hypothesis, etc.)
  - Content textarea (up to 10,000 chars)
  - Importance slider (0-100%)
  - Tags input
  - Status dropdown
- "Save" and "Cancel" buttons

---

### User Story 2 - Edit Node Content and Regenerate Downstream (Priority: P0)

**As a user**, I want to edit a node's prompt in the middle of a reasoning chain and have all child nodes automatically regenerated, **so that** the reasoning stays consistent with my changes.

**Acceptance Scenarios**:

1. **Given** a chain of 5 nodes (Q1 → A1 → Q2 → A2 → Summary), **When** I edit Q2's prompt, **Then** A2 and Summary are marked for regeneration
2. **Given** nodes marked for regeneration, **When** I click "Regenerate Chain", **Then** the LLM re-processes A2 using new Q2, then re-processes Summary using new A2
3. **Given** regeneration in progress, **When** I view the canvas, **Then** regenerating nodes show a spinner/progress indicator
4. **Given** regeneration completes, **When** I view the nodes, **Then** they show updated content with new timestamps
5. **Given** regeneration fails, **When** I view the canvas, **Then** an error message appears with retry option

**Cascade Logic**:
```
Modified Node: Q2
Direct Children: A2 (needs regen)
Grandchildren: Summary (needs regen after A2)
Unaffected: Q1, A1 (upstream nodes unchanged)
```

**UI Requirements**:
- "Edit" button on node context menu
- Edit modal (same as creation modal, pre-filled)
- "Regenerate Chain" confirmation dialog showing affected nodes
- Progress indicators on regenerating nodes
- Error toast notifications

---

### User Story 3 - Version History and Rollback (Priority: P1)

**As a user**, I want to see previous versions of node content after regeneration, **so that** I can compare old vs new responses and rollback if needed.

**Acceptance Scenarios**:

1. **Given** a node with 3 regenerations, **When** I click "View History", **Then** a timeline shows all 3 versions with timestamps
2. **Given** the version history timeline, **When** I select version 2, **Then** the node content updates to show version 2 text (read-only preview)
3. **Given** I'm previewing version 2, **When** I click "Restore This Version", **Then** version 2 becomes the current version (version 4 created)
4. **Given** version history, **When** I hover over a version, **Then** I see: content diff, timestamp, trigger reason ("manual edit", "cascade from parent")
5. **Given** a node, **When** I delete it, **Then** all versions are soft-deleted (archived, not destroyed)

**Data Model Extension**:
```python
class NodeVersion(BaseModel):
    version_id: UUID
    node_id: UUID  # Parent node
    version_number: int  # 1, 2, 3...
    content: str
    created_at: datetime
    trigger_reason: Literal["manual_edit", "parent_cascade", "user_regen", "rollback"]
    llm_metadata: dict | None  # Model used, tokens, etc.
```

**UI Requirements**:
- "History" icon button on node
- Version timeline sidebar (like Git history)
- Diff viewer (highlight changes between versions)
- "Restore" and "Compare" actions

---

### User Story 4 - LLM Provider Configuration (Priority: P1)

**As a user**, I want to configure which LLM provider and model to use for node generation, **so that** I can use my preferred AI service (OpenAI, Anthropic, local, etc.).

**Acceptance Scenarios**:

1. **Given** I open Settings panel, **When** I navigate to "LLM Config" tab, **Then** I see provider dropdown (OpenAI, Anthropic, Ollama, Custom)
2. **Given** I select "OpenAI", **When** I enter API key and select model "gpt-4", **Then** settings are saved to localStorage (encrypted) and validated
3. **Given** configured LLM, **When** I create an "answer" node with parent "question", **Then** the LLM auto-generates answer content
4. **Given** LLM auto-generation, **When** it completes, **Then** the node shows LLM attribution footer "Generated by gpt-4 (256 tokens)"
5. **Given** invalid API key, **When** I try to generate, **Then** an error shows "Authentication failed - check API key"

**Settings Schema**:
```typescript
interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'ollama' | 'custom';
  apiKey: string; // Encrypted in localStorage
  model: string; // e.g., "gpt-4", "claude-3-sonnet"
  baseURL?: string; // For custom/local models
  temperature: number; // 0.0-1.0
  maxTokens: number;
}
```

**UI Requirements**:
- New "LLM" tab in SettingsPanel
- Provider selector with logos
- API key input (password field)
- Model dropdown (populated based on provider)
- Temperature slider
- "Test Connection" button
- Save indicator

---

## Architecture & Technical Design

### Frontend Components (New)

```
frontend/src/
├── components/
│   ├── NodeEditor.tsx          # Edit node modal
│   ├── NodeCreator.tsx         # Create node modal
│   ├── VersionHistory.tsx      # Version timeline sidebar
│   ├── LLMConfigPanel.tsx      # LLM settings in Settings
│   └── ContextMenu.tsx         # Right-click menu
├── features/
│   └── llm/
│       ├── hooks/
│       │   ├── useLLMGenerate.ts   # Trigger LLM generation
│       │   └── useCascadeRegen.ts  # Handle cascade logic
│       └── utils/
│           ├── llm-client.ts       # LLM API abstraction
│           └── cascade.ts          # Topological sort for regen order
```

### Backend API Endpoints (New)

```yaml
# Node CRUD
POST   /api/graphs/{graph_id}/nodes          # Create node
PUT    /api/graphs/{graph_id}/nodes/{node_id}  # Update node
DELETE /api/graphs/{graph_id}/nodes/{node_id}  # Delete node (soft)

# LLM Orchestration
POST   /api/graphs/{graph_id}/generate        # Generate node content via LLM
  Body: { node_id, context_node_ids[], llm_config }

POST   /api/graphs/{graph_id}/regenerate-cascade  # Regenerate from node downwards
  Body: { modified_node_id }

# Version History
GET    /api/graphs/{graph_id}/nodes/{node_id}/versions  # List versions
POST   /api/graphs/{graph_id}/nodes/{node_id}/versions/{version_id}/restore  # Rollback
```

### Cascade Regeneration Algorithm

```python
def regenerate_cascade(graph: Graph, modified_node_id: UUID):
    """
    Regenerate all downstream nodes affected by a modification.
    Uses topological sort to ensure parents are generated before children.
    """
    # 1. Find all descendants of modified node
    descendants = graph.get_descendants(modified_node_id)

    # 2. Topological sort to get generation order
    sorted_nodes = topological_sort(descendants)

    # 3. For each node in order, regenerate using LLM
    for node_id in sorted_nodes:
        node = graph.nodes[node_id]

        # Get parent nodes as context
        parent_nodes = [graph.nodes[pid] for pid in node.parents]

        # Call LLM to generate new content
        new_content = llm_generate(
            node_type=node.type,
            context=parent_nodes,
            previous_content=node.content,  # For reference
        )

        # Create new version
        new_version = NodeVersion(
            node_id=node_id,
            version_number=get_next_version(node_id),
            content=new_content,
            trigger_reason="parent_cascade",
        )

        # Update node
        node.content = new_content
        node.update_timestamp()
        save_version(new_version)
```

---

## Future Enhancements (Out of Scope for v1)

- **Branching**: Create alternative paths from a node (A/B testing different prompts)
- **Merge nodes**: Combine insights from multiple nodes into one
- **Batch operations**: Edit/regenerate multiple nodes at once
- **Templates**: Save node chains as reusable templates
- **Collaboration**: Multi-user real-time editing
- **Export**: Export graph as PDF/image/markdown

---

## Success Metrics

1. **Graph Creation**: Users can create a new graph and add 5+ nodes in <2 minutes
2. **Edit Workflow**: Users can edit a mid-chain node and regenerate downstream in <30 seconds
3. **Version Rollback**: Users can view history and restore previous version in <10 seconds
4. **LLM Integration**: 95%+ of LLM generations succeed on first try (excluding user errors)

---

## Dependencies & Risks

**Dependencies**:
- Feature 001: MindFlow Engine with LLM provider abstraction
- Feature 002: Canvas interface for visualization

**Risks**:
- **LLM latency**: Cascade regeneration on large chains could take minutes
  - Mitigation: Show progress, allow cancellation, queue system
- **Version storage**: History could grow large (many versions per node)
  - Mitigation: Limit to last 10 versions per node, archive older
- **Race conditions**: User edits node while cascade is running
  - Mitigation: Lock nodes during regeneration, queue edits

---

## Notes

This spec was created based on user feedback: "ok mais je crée comment un nouveau flow ? et ou je rentre mon prompt LLM ? il faut que si je modifie une prompt LLM (au milieux d'une série de nodes ) il faut refaire tout les réponse a la suite a parti de la modif du node"

**Critical insight**: Feature 002 delivered a READ-ONLY canvas. This feature (003) adds the WRITE/EXECUTE layer that makes MindFlow truly interactive.
