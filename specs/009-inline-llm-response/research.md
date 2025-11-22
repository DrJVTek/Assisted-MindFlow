# Feature 009 Technical Research Findings: Inline LLM Response Display

## 1. Markdown Rendering Library for React

### Decision: **react-markdown**

### Rationale:
1. **XSS Safety (Critical)**: react-markdown renders markdown to React components instead of HTML strings, avoiding `dangerouslySetInnerHTML` entirely. This provides inherent XSS protection without requiring DOMPurify.

2. **React Integration**: Native React component approach integrates seamlessly with existing React Flow and component architecture. Renders markdown as React elements, allowing for better lifecycle management and state integration.

3. **Performance for Target Use Case**: While slightly slower than marked for large documents, react-markdown is sufficient for the target requirement (<100ms for 10k chars). The React virtual DOM overhead is negligible for streaming scenarios where content is incrementally updated.

4. **Bundle Size**: Acceptable tradeoff - react-markdown includes remark ecosystem dependencies, but provides extensibility through plugins (syntax highlighting, custom renderers).

5. **Ecosystem**: Part of the unified/remark ecosystem, providing future extensibility for advanced features (syntax highlighting via rehype-highlight, custom components via react-markdown's `components` prop).

### Alternatives Considered:

**marked + DOMPurify**:
- **Rejected because**: Requires `dangerouslySetInnerHTML` which adds XSS risk if DOMPurify configuration is incorrect. Performance gain (~20-30% faster) is not worth security complexity and maintenance burden.
- Performance: Faster parsing (marked is highly optimized), but must sanitize HTML separately
- Bundle size: Smaller (marked ~10KB, DOMPurify ~20KB vs react-markdown ~35KB)
- Trade-off: Speed vs. safety - rejected due to XSS concerns

**markdown-it**:
- **Rejected because**: Similar to marked - outputs HTML strings requiring sanitization. More extensible than marked but doesn't solve the React integration problem.

### Implementation Notes:

**Installation**:
```bash
npm install react-markdown remark-gfm rehype-highlight
```

**Basic Usage**:
```tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

<ReactMarkdown
  remarkPlugins={[remarkGfm]}
  rehypePlugins={[rehypeHighlight]}
>
  {content}
</ReactMarkdown>
```

**Key Gotchas**:
- Include `remark-gfm` for GitHub Flavored Markdown (tables, strikethrough, task lists)
- Code syntax highlighting requires `rehype-highlight` + CSS theme (import highlight.js CSS)
- Performance optimization: Memoize markdown content to prevent re-parsing on parent re-renders

**Security**:
- By default, react-markdown disallows dangerous HTML/protocols (no XSS risk)
- For this feature: **Do NOT allow raw HTML** - stick with pure markdown rendering

---

## 2. Auto-Launch Hook Pattern

### Decision: **useEffect with `useRef` flag pattern**

### Rationale:
1. **Reliable Detection**: `useRef` persists across re-renders, allowing accurate detection of initial mount vs subsequent renders. React 19 Strict Mode causes double-mounting in dev, but `useRef` handles this correctly.

2. **Clean Separation**: Hook encapsulates auto-launch logic separately from node rendering, maintaining single responsibility principle.

3. **React Flow Compatibility**: React Flow re-renders nodes frequently (viewport changes, selection, drag). Using `useRef` prevents duplicate LLM launches during these re-renders.

4. **Existing Infrastructure**: Leverages existing `llmOperationsStore` and `useStreamingContent` hook from Feature 007/008 - no new state management needed.

### Implementation Pattern:

```typescript
// hooks/useAutoLaunchLLM.ts
export function useAutoLaunchLLM(
  nodeId: UUID,
  graphId: UUID,
  shouldAutoLaunch: boolean, // Only launch for NEW nodes
  questionContent: string
) {
  const hasLaunchedRef = useRef(false);
  const { createOperation } = useLLMOperationsStore();
  const { startStreaming } = useStreamingContent(nodeId);

  useEffect(() => {
    if (hasLaunchedRef.current || !shouldAutoLaunch || !questionContent) {
      return;
    }

    hasLaunchedRef.current = true;

    (async () => {
      try {
        const operationId = await createOperation({
          nodeId,
          graphId,
          provider: 'ollama',
          model: 'llama2',
          prompt: questionContent,
        });

        await startStreaming(operationId);
      } catch (error) {
        console.error('Auto-launch failed:', error);
        hasLaunchedRef.current = false;
      }
    })();

  }, [nodeId, graphId, shouldAutoLaunch, questionContent, createOperation, startStreaming]);
}
```

### Detecting "New Node Creation" vs "Existing Node Render":

**Approach**: Add `isNewNode` flag to node data when creating node, remove flag after first render.

### Alternatives Considered:

**Dependency array with empty `[]`**:
- **Rejected because**: Runs on every mount, including React Flow's internal re-mounts during viewport changes. Would cause duplicate LLM operations.

**Check operation existence in store**:
- **Rejected because**: Race condition - multiple renders could occur before operation is created.

---

## 3. Scroll Container Implementation

### Decision: **CSS `overflow-y: auto` with `will-change: transform` and `contain: paint layout`**

### Rationale:
1. **Simplicity**: Native CSS scrolling is the simplest and most reliable approach. Browser-native scrolling provides best accessibility (keyboard nav, screen readers).

2. **Performance**: For 50k characters, native scrolling with GPU acceleration (`will-change: transform`) provides 60fps smooth scrolling without JavaScript libraries.

3. **Compatibility**: Works across all modern browsers (Chrome, Firefox, Edge) without additional dependencies.

### Implementation:

```css
.response-section {
  flex: 1;
  overflow-y: auto;
  padding: 12px;

  /* Performance optimizations */
  will-change: transform;
  contain: paint layout;
  scroll-behavior: smooth;
}

/* Accessibility: Respect reduced motion preference */
@media (prefers-reduced-motion: reduce) {
  .response-section {
    scroll-behavior: auto;
  }
}
```

### Alternatives Considered:

**Lenis smooth scroll library**:
- **Rejected because**: Overkill for container scrolling. Adds 15KB+ bundle size for minimal UX gain.

**Virtual scrolling (react-window)**:
- **Not needed**: Modern browsers handle 50k characters efficiently. Only consider if performance issues arise with >100k chars.

---

## 4. Node Resize Handling

### Decision: **React Flow NodeResizer component with content reflow**

### Rationale:
1. **Built-in Solution**: React Flow provides `NodeResizer` component designed for this exact use case. No custom resize logic needed.

2. **React Flow Integration**: Automatically updates node dimensions in React Flow state, triggering re-renders with new dimensions.

3. **Performance**: Resize operations handled by React Flow's optimized rendering pipeline. Content reflow is CSS-driven (flexbox), not JavaScript-driven.

### Implementation:

```tsx
import { NodeResizer } from 'reactflow';

function CustomNode({ data, selected }: NodeProps) {
  return (
    <>
      <NodeResizer
        minWidth={280}
        minHeight={200}
        maxWidth={800}
        maxHeight={1200}
        isVisible={selected}
        color="#1976D2"
      />

      <div className="node-content">
        <LLMNodeContent {...data} />
      </div>
    </>
  );
}
```

**Content Reflow with Flexbox**:
```css
.llm-response-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.question-section {
  flex-shrink: 0; /* Fixed height */
}

.response-section {
  flex: 1; /* Expands to fill */
  overflow-y: auto;
}
```

### Alternatives Considered:

**Custom resize handles with mouse events**:
- **Rejected because**: Reinventing the wheel. React Flow's NodeResizer is battle-tested.

**CSS `resize` property**:
- **Rejected because**: Doesn't integrate with React Flow's node state.

---

## Summary Table

| Decision Area | Chosen Approach | Key Benefit | Main Trade-off |
|---------------|-----------------|-------------|----------------|
| **Markdown Rendering** | react-markdown | XSS-safe by default, React-native | Slightly slower than marked (~10-20%) |
| **Auto-Launch Hook** | useEffect + useRef flag | Reliable mount detection, prevents duplicates | Requires `isNewNode` flag in node data |
| **Scroll Container** | CSS overflow-y: auto + GPU acceleration | Simple, performant, accessible | No virtual scrolling (fine for <100k chars) |
| **Node Resize** | React Flow NodeResizer | Built-in, battle-tested, integrates with RF state | Requires React Flow v11+ |
