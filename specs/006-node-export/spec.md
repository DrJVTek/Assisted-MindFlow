# Feature Specification: Node Export

**Feature Branch**: `006-node-export`
**Created**: 2025-11-21
**Status**: Draft
**Input**: User description: "il faudrait aussi prévoir des export des nodes ... en markdown ou pdf que ce soit que le node ou tout l'arborécence lineaire du node si c'est le dernier ou tout l'arborécence total si c'est un node avec des fils ... (même si dans ce cas c'est compliqué a exporter car non lineaire : peu etre en html ou markdown ou pdf avec des hyperliens ? )"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Export Single Node (Priority: P1)

Users need to export an individual node's content to preserve their reasoning, share insights, or create documentation outside the application. This provides a quick way to extract a specific thought or answer.

**Why this priority**: Core functionality - single node export is the foundation for all other export capabilities. It's the most straightforward and commonly needed feature, making it the ideal MVP.

**Independent Test**: User right-clicks on any node → selects "Export" → chooses markdown format → downloads file containing node type, content, metadata (author, timestamp, tags) → opens file and verifies content matches node.

**Acceptance Scenarios**:

1. **Given** user is viewing a graph with nodes, **When** they right-click on a node and select "Export Node", **Then** an export dialog appears with format options (Markdown, PDF, HTML)
2. **Given** user selects markdown format, **When** export completes, **Then** a `.md` file is downloaded with node content, type, author, timestamp, and tags
3. **Given** user selects PDF format, **When** export completes, **Then** a `.pdf` file is downloaded with formatted node content including visual styling
4. **Given** node contains code blocks or formatting, **When** exported to markdown, **Then** formatting is preserved using proper markdown syntax
5. **Given** node has long content (1000+ words), **When** exported to PDF, **Then** content is paginated correctly with proper headers/footers
6. **Given** user exports a node, **When** export fails (disk full, permissions), **Then** clear error message is displayed with suggested actions

---

### User Story 2 - Export Linear Ancestor Chain (Priority: P2)

Users need to export a node along with its ancestor chain (parent → grandparent → root) to provide context for their reasoning. This creates a linear narrative showing how the thought evolved from earlier questions/hypotheses.

**Why this priority**: Adds significant value by showing context - users often need to understand the path that led to a conclusion, not just the conclusion itself. Required before exporting full tree structures.

**Independent Test**: User selects a leaf node (no children) → exports with "Include ancestors" option → downloads file showing hierarchical structure from root to selected node with clear parent-child relationships → verifies complete reasoning chain is present.

**Acceptance Scenarios**:

1. **Given** user right-clicks on a node with ancestors, **When** they select "Export with Ancestors", **Then** export includes all parent nodes up to the root in hierarchical order
2. **Given** exported chain in markdown, **When** user views file, **Then** hierarchy is shown with indentation (e.g., `# Root > ## Parent > ### Child`)
3. **Given** node has multiple ancestors (5+ levels), **When** exported to PDF, **Then** content is organized with clear visual hierarchy (headings, indentation, page breaks)
4. **Given** ancestor nodes have metadata, **When** exported, **Then** each node's author, type, and timestamp are included
5. **Given** user exports with ancestors, **When** one ancestor is a group node, **Then** group metadata (label, kind) is included in export
6. **Given** export includes 20+ nodes in chain, **When** exporting to markdown, **Then** table of contents is automatically generated at the beginning

---

### User Story 3 - Export Full Tree with Children (Priority: P2)

Users need to export a node and all its descendants (children, grandchildren, etc.) to capture a complete subtree of reasoning. This is useful for comprehensive documentation, presentations, or sharing entire reasoning branches.

**Why this priority**: Completes the export capability by handling complex non-linear structures. Critical for exporting root nodes or major branches, but requires careful handling of graph visualization.

**Independent Test**: User selects a node with multiple children → exports with "Include descendants" option → downloads HTML file with hyperlinked navigation between related nodes → verifies all nodes in subtree are present and navigable.

**Acceptance Scenarios**:

1. **Given** user right-clicks on a node with children, **When** they select "Export Full Tree", **Then** export includes the node and all descendants in a navigable structure
2. **Given** exported tree in HTML, **When** user opens file, **Then** nodes are presented as an interactive tree with collapsible sections or hyperlinks
3. **Given** tree has 50+ nodes, **When** exported to markdown, **Then** nodes are organized by level with anchor links for cross-referencing
4. **Given** node has multiple children at same level, **When** exported to PDF, **Then** children are listed with clear labels (Child 1, Child 2) and visual connection to parent
5. **Given** tree includes nodes with circular references (edge case), **When** exported, **Then** system detects cycle and includes each node only once with clear notation of the cycle
6. **Given** tree export includes group nodes, **When** rendered, **Then** grouped nodes are visually distinguished (e.g., boxed sections in PDF, collapsible groups in HTML)

---

### User Story 4 - Customize Export Format and Styling (Priority: P3)

Users need to customize export appearance (theme, font size, included metadata) to match their presentation or documentation needs. This provides flexibility for different use cases (academic papers, business reports, presentations).

**Why this priority**: Nice-to-have enhancement - core export functionality works without customization, but personalization improves user experience for power users.

**Independent Test**: User accesses export settings → selects dark theme, large fonts, excludes timestamps → exports node → verifies exported file matches selected styling preferences.

**Acceptance Scenarios**:

1. **Given** user opens export dialog, **When** they click "Customize", **Then** styling options appear (theme, font size, metadata inclusion toggles)
2. **Given** user selects "Minimal" export, **When** exported, **Then** only node content is included (no metadata, timestamps, or styling)
3. **Given** user selects "Academic" style, **When** exported to PDF, **Then** content includes footnotes, citation format, and formal headers
4. **Given** user sets default export preferences, **When** they export any node, **Then** preferences are remembered and auto-applied
5. **Given** user exports to HTML, **When** they select "Dark theme", **Then** HTML file uses dark background with light text for readability

---

### Edge Cases

- What happens when a node's content contains special characters (e.g., markdown syntax, HTML tags)?
  - System should escape or encode special characters appropriately for the target format to prevent rendering issues.

- How does system handle very large trees (500+ nodes)?
  - System should warn user about large export size, offer pagination or depth limits, and optimize file size (compress images, minimize HTML).

- What happens if export format doesn't support hyperlinks (PDF)?
  - For PDF exports of non-linear trees, use page references (e.g., "See page 12 for Child Node A") instead of clickable hyperlinks.

- How does system handle nodes with image attachments or external references?
  - Images should be embedded (base64 in HTML/markdown) or linked (PDF). External links should be preserved as clickable/copyable URLs.

- What happens when user cancels export mid-process?
  - Export should be interruptible, with partial progress discarded and clear confirmation message.

- How does system handle export of nodes with LLM-generated content that includes copyrighted material?
  - Include disclaimer in export footer indicating content is AI-generated and user is responsible for copyright compliance.

## Requirements *(mandatory)*

### Functional Requirements

#### Core Export Functionality

- **FR-001**: System MUST provide "Export Node" option in node context menu (right-click)
- **FR-002**: System MUST support exporting single nodes with all metadata (type, content, author, timestamp, tags, importance)
- **FR-003**: System MUST support exporting node with ancestor chain (linear path from root to selected node)
- **FR-004**: System MUST support exporting node with all descendants (full subtree)
- **FR-005**: Users MUST be able to choose export scope: single node, with ancestors, with descendants, or full tree (ancestors + descendants)
- **FR-006**: System MUST detect and handle circular references in graph to prevent infinite loops during export

#### Export Formats

- **FR-007**: System MUST support markdown (.md) export format
- **FR-008**: System MUST support PDF (.pdf) export format
- **FR-009**: System MUST support HTML (.html) export format with embedded CSS for standalone viewing
- **FR-010**: Markdown exports MUST use proper markdown syntax (headers, lists, code blocks, links)
- **FR-011**: PDF exports MUST include page numbers, headers/footers, and proper pagination
- **FR-012**: HTML exports MUST include collapsible sections or anchor navigation for complex trees

#### Content Preservation

- **FR-013**: System MUST preserve node content formatting (bold, italic, code blocks, lists) in exports
- **FR-014**: System MUST escape special characters appropriately for target format (e.g., escape `#` in markdown)
- **FR-015**: System MUST include node metadata in exports: type, author, creation timestamp, tags
- **FR-016**: System MUST maintain hierarchy/structure when exporting multiple nodes (indentation, headings, nesting)
- **FR-017**: For multi-node exports, system MUST clearly indicate relationships (parent-child connections, sibling order)

#### Navigation and Usability

- **FR-018**: HTML exports MUST include table of contents with anchor links for exports with 10+ nodes
- **FR-019**: Markdown exports with 20+ nodes MUST include auto-generated table of contents at beginning
- **FR-020**: PDF exports MUST include bookmarks (outline pane) for navigation in trees with 5+ levels
- **FR-021**: For non-linear trees (node with multiple children), system MUST provide navigation mechanism appropriate to format (hyperlinks in HTML, page references in PDF)
- **FR-022**: System MUST visually distinguish node types in exports (e.g., different headings for question vs. answer nodes)

#### Export Process & UI

- **FR-023**: System MUST display export dialog with format selection (markdown/PDF/HTML) and scope options
- **FR-024**: System MUST show progress indicator for exports with 50+ nodes
- **FR-025**: System MUST allow users to cancel in-progress exports
- **FR-026**: Completed exports MUST automatically trigger file download with descriptive filename (e.g., `node-question-2025-11-21.md`)
- **FR-027**: System MUST display clear error messages if export fails (disk full, permissions, too large)
- **FR-028**: System MUST log export actions for audit trail (node ID, format, scope, timestamp, success/failure)

#### Customization

- **FR-029**: Users MUST be able to toggle metadata inclusion (show/hide timestamps, authors, tags)
- **FR-030**: Users MUST be able to select export theme (light, dark, minimal) for HTML/PDF outputs
- **FR-031**: System MUST remember user's export preferences (format, theme, metadata options) across sessions
- **FR-032**: Users MUST be able to set depth limit for tree exports (e.g., "export only 3 levels deep")

#### Performance & Limits

- **FR-033**: System MUST complete single node exports in under 2 seconds
- **FR-034**: System MUST warn users when attempting to export trees with 500+ nodes
- **FR-035**: System MUST optimize export file size (compress images, minify HTML) to keep under 10MB for typical use cases

### Key Entities

- **ExportRequest**: Represents a user's export action
  - Node ID (which node to export)
  - Scope (single, with_ancestors, with_descendants, full_tree)
  - Format (markdown, pdf, html)
  - Options (include_metadata, theme, depth_limit)
  - Timestamp

- **ExportedContent**: The structured content prepared for export
  - Node list (ordered by hierarchy/relationship)
  - Content for each node (with formatting preserved)
  - Metadata for each node (type, author, timestamps)
  - Navigation structure (parent-child relationships, hyperlinks)
  - Theme/styling information

- **ExportFile**: The generated output file
  - Filename (descriptive, with timestamp)
  - Format (md, pdf, html)
  - Content (rendered output)
  - File size
  - Download URL or blob

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can successfully export a single node in under 5 clicks (right-click → export → format → download)
- **SC-002**: 90% of single node exports complete in under 2 seconds
- **SC-003**: Exported markdown files are valid markdown syntax (pass linting tools like markdownlint)
- **SC-004**: Exported PDFs are readable with proper formatting on 95% of PDF readers (Adobe, browsers, mobile)
- **SC-005**: HTML exports render correctly in all major browsers (Chrome, Firefox, Safari, Edge) without external dependencies
- **SC-006**: Users can export trees with 100 nodes in under 10 seconds
- **SC-007**: Export success rate is above 98% for typical use cases (non-corrupted graphs, reasonable node counts)
- **SC-008**: Exported files maintain 100% content fidelity (no data loss) compared to source nodes
- **SC-009**: 85% of users successfully export and share nodes on first attempt without support
- **SC-010**: Users can navigate complex tree exports (50+ nodes) and find specific nodes in under 30 seconds using table of contents or hyperlinks

### Qualitative Outcomes

- Users feel confident sharing their reasoning graphs with colleagues or stakeholders
- Exported documents are professional-quality and suitable for presentations or reports
- Navigation in complex tree exports feels intuitive and not overwhelming
- Users appreciate flexibility in choosing export scope and format based on their needs

## Assumptions *(optional)*

- Users have basic understanding of file formats (markdown, PDF, HTML) and when to use each
- Most exports will be for small to medium trees (1-50 nodes), with occasional large exports (100-500 nodes)
- Users have standard desktop/laptop with sufficient disk space and memory for export generation
- Exported files are intended for viewing/sharing, not for re-importing into application (export is one-way)
- PDF generation can be handled by headless browser (Puppeteer, Playwright) or PDF libraries
- Markdown is sufficient for most technical users; PDF/HTML are for non-technical stakeholders
- Graphs do not contain extremely long content (10,000+ words per node) that would create unwieldy exports

## Dependencies *(optional)*

- **External Dependencies**:
  - PDF generation library or headless browser for PDF exports
  - Markdown rendering library for preview (if applicable)
  - File download/save mechanism in browser or desktop environment

- **Internal Dependencies**:
  - Graph traversal utilities to collect nodes by relationship
  - Cycle detection algorithm to handle circular references
  - Node content formatting utilities
  - User preference storage system

## Out of Scope *(optional)*

- Exporting entire graphs (multi-root structures) - focus is on single node and its relationships
- Real-time collaborative editing of exported documents
- Re-importing exported files back into the application
- Version control or diff tracking for exported files
- Batch export of multiple unrelated nodes in single operation
- Export to specialized formats (LaTeX, Word .docx, PowerPoint)
- Cloud storage integration (Dropbox, Google Drive) - exports are local downloads only
- Email sharing directly from export dialog (users download then share manually)
- Export scheduling or automation (always user-initiated)

## Notes *(optional)*

### Technical Context

The MindFlow graph structure is a DAG (Directed Acyclic Graph) in most cases, but circular references may exist due to manual edge creation. Export functionality must handle this gracefully by tracking visited nodes.

Node types (question, answer, hypothesis, evaluation, etc.) should be visually distinguished in exports to maintain semantic meaning.

### User Experience Considerations

- Export dialog should be lightweight and not interrupt the user's workflow
- Default export options should work for 80% of use cases (single node, markdown, all metadata)
- Power users should have access to advanced options without cluttering the UI for casual users
- File naming should be descriptive (include node type, content preview, timestamp) to help users organize exports

### Format Selection Guidance

- **Markdown**: Best for technical users, developers, documentation, version control
- **PDF**: Best for stakeholders, presentations, printing, formal reports
- **HTML**: Best for interactive viewing, complex trees, self-contained sharing

### Future Enhancements (Not in Initial Scope)

- Export templates (pre-configured styles for different use cases: presentation, academic paper, business report)
- Batch export with filtering (e.g., "export all questions from last week")
- Integration with presentation tools (export directly to PowerPoint slide format)
- Collaborative annotations on exported documents
- Export analytics (track which nodes are exported most frequently)
