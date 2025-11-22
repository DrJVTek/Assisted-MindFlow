# Quickstart: Feature 009 - Inline LLM Response Display

## Overview

This feature adds automatic LLM response generation when creating nodes, with inline question + markdown-formatted response display within the node UI.

**Key Changes**:
- Node schema extension (5 new fields)
- New React components (`LLMNodeContent`, `MarkdownRenderer`)
- New hook (`useAutoLaunchLLM`)
- Integration with existing LLM operations infrastructure (Feature 007/008)

## Setup

### 1. Install Dependencies

```bash
cd frontend
npm install react-markdown remark-gfm rehype-highlight
```

**Packages**:
- `react-markdown`: Markdown renderer (XSS-safe, React-native)
- `remark-gfm`: GitHub Flavored Markdown plugin (tables, strikethrough, task lists)
- `rehype-highlight`: Syntax highlighting for code blocks

### 2. Backend Schema Update

Update `backend/src/models/graph.py`:

```python
from pydantic import BaseModel, Field
from typing import Optional

class Node(BaseModel):
    # ... existing fields ...

    # NEW FIELDS
    llm_response: Optional[str] = Field(None, max_length=100000)
    llm_operation_id: Optional[str] = None
    font_size: int = Field(14, ge=10, le=24)
    node_width: int = Field(400, ge=280, le=800)
    node_height: int = Field(400, ge=200, le=1200)
```

No migration script needed - fields are optional, backward compatible.

### 3. Frontend Type Update

Update `frontend/src/types/graph.ts`:

```typescript
export interface Node {
  // ... existing fields ...

  // NEW FIELDS
  llm_response?: string | null;
  llm_operation_id?: UUID | null;
  font_size?: number; // 10-24, default 14
  node_width?: number; // 280-800, default 400
  node_height?: number; // 200-1200, default 400
}
```

## Key Components

### 1. Auto-Launch Hook (`hooks/useAutoLaunchLLM.ts`)

**Purpose**: Automatically triggers LLM operation when new node is created.

**Usage**:
```typescript
// In Node.tsx
const { isNewNode, content, nodeId, graphId } = data;

useAutoLaunchLLM(nodeId, graphId, isNewNode, content);
```

**Key Logic**:
- Uses `useRef` to prevent duplicate launches on re-renders
- Checks `isNewNode` flag (set during node creation, cleared after mount)
- Leverages existing `useLLMOperationsStore` and `useStreamingContent`

### 2. LLM Node Content (`components/LLMNodeContent.tsx`)

**Purpose**: Renders question + markdown response with scrollbar.

**Structure**:
```tsx
<div className="llm-response-container">
  <div className="question-section">
    {questionContent}
  </div>

  <div className="response-section">
    <MarkdownRenderer content={llmResponse} />
  </div>
</div>
```

**CSS**:
```css
.llm-response-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.question-section {
  flex-shrink: 0;
  padding: 12px;
  border-bottom: 1px solid #e0e0e0;
}

.response-section {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  will-change: transform;
  contain: paint layout;
}
```

### 3. Markdown Renderer (`components/MarkdownRenderer.tsx`)

**Purpose**: XSS-safe markdown rendering with syntax highlighting.

**Implementation**:
```tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

export const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
    >
      {content}
    </ReactMarkdown>
  );
};
```

**Don't forget**: Import highlight.js CSS theme in `main.tsx`:
```typescript
import 'highlight.js/styles/github.css'; // or any theme
```

### 4. Node Resize Integration (`Node.tsx`)

**Purpose**: Allow users to resize nodes with content reflow.

**Implementation**:
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
      />

      <div className="node-content">
        <LLMNodeContent {...data} />
      </div>
    </>
  );
}
```

## Data Flow

### Node Creation Flow

```
1. User clicks "Add Node" → NodeCreator dialog
   ↓
2. User enters question → clicks "Create"
   ↓
3. api.createNode({ content: "question", ... })
   ↓
4. Backend creates Node with llm_response=null
   ↓
5. Frontend receives node, adds to ReactFlow with isNewNode=true
   ↓
6. Node renders → useAutoLaunchLLM detects isNewNode
   ↓
7. Create LLM operation → start streaming
   ↓
8. Response streams incrementally → updates llm_response locally
   ↓
9. On completion → persist llm_response to backend
```

### Manual Regeneration Flow

```
1. User right-clicks node → "Ask LLM"
   ↓
2. Cancel existing operation (if active)
   ↓
3. Create new LLM operation
   ↓
4. Clear llm_response locally → start streaming
   ↓
5. On completion → persist new llm_response
```

## Testing

### Unit Tests

**Test auto-launch hook**:
```typescript
// tests/unit/useAutoLaunchLLM.test.ts
describe('useAutoLaunchLLM', () => {
  it('launches LLM on mount when isNewNode=true', async () => {
    const { result } = renderHook(() =>
      useAutoLaunchLLM('node-1', 'graph-1', true, 'test question')
    );

    await waitFor(() => {
      expect(mockCreateOperation).toHaveBeenCalledWith({
        nodeId: 'node-1',
        graphId: 'graph-1',
        prompt: 'test question',
      });
    });
  });

  it('does not launch when isNewNode=false', () => {
    renderHook(() =>
      useAutoLaunchLLM('node-1', 'graph-1', false, 'test')
    );

    expect(mockCreateOperation).not.toHaveBeenCalled();
  });
});
```

**Test markdown rendering**:
```typescript
// tests/unit/MarkdownRenderer.test.tsx
describe('MarkdownRenderer', () => {
  it('renders markdown with syntax highlighting', () => {
    const markdown = '# Title\n```js\nconst x = 1;\n```';
    render(<MarkdownRenderer content={markdown} />);

    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('const x = 1;')).toBeInTheDocument();
  });

  it('sanitizes malicious content', () => {
    const malicious = '<script>alert("xss")</script>';
    render(<MarkdownRenderer content={malicious} />);

    expect(screen.queryByText('alert("xss")')).not.toBeInTheDocument();
  });
});
```

### Integration Tests

**Test end-to-end auto-launch**:
```typescript
// tests/integration/auto_launch_flow.test.tsx
describe('Auto-launch flow', () => {
  it('creates node → auto-launches LLM → displays response', async () => {
    // 1. Create node
    const node = await createNode({ content: 'test question' });

    // 2. Verify auto-launch
    await waitFor(() => {
      expect(mockStreamingHook).toHaveBeenCalled();
    });

    // 3. Simulate streaming response
    act(() => {
      updateStreamingContent('node-1', 'Test response');
    });

    // 4. Verify response displayed
    expect(screen.getByText('Test response')).toBeInTheDocument();
  });
});
```

## Common Issues & Solutions

### Issue: LLM auto-launches multiple times

**Cause**: `useRef` not preventing re-renders.

**Solution**: Ensure `hasLaunchedRef.current = true` is set BEFORE async operation:
```typescript
hasLaunchedRef.current = true; // Set immediately
await createOperation(...); // Then async
```

### Issue: Markdown not rendering (shows raw text)

**Cause**: Missing plugins or CSS theme.

**Solution**:
1. Install plugins: `npm install remark-gfm rehype-highlight`
2. Import CSS: `import 'highlight.js/styles/github.css'` in `main.tsx`
3. Pass plugins to ReactMarkdown:
```tsx
<ReactMarkdown
  remarkPlugins={[remarkGfm]}
  rehypePlugins={[rehypeHighlight]}
>
  {content}
</ReactMarkdown>
```

### Issue: Scrollbar not appearing

**Cause**: Parent container missing `height`.

**Solution**: Ensure `.llm-response-container` has `height: 100%` and parent node has fixed height:
```typescript
const node = {
  id: 'node-1',
  style: {
    height: 400, // Required for scroll calculation
  }
};
```

### Issue: Node resize doesn't reflow content

**Cause**: Missing flexbox CSS.

**Solution**: Ensure `.response-section` has `flex: 1`:
```css
.response-section {
  flex: 1; /* Expands to fill */
  overflow-y: auto;
}
```

## Development Workflow

1. **Make changes** to components/hooks
2. **Run tests**: `npm test` (frontend), `pytest` (backend)
3. **Manual test**:
   - Start servers: `restart.bat` (Windows) or `./restart.sh` (Linux)
   - Open http://localhost:5173
   - Create node → verify auto-launch → check markdown rendering
4. **Check console** for errors (auto-launch logs, streaming updates)
5. **Commit** with descriptive message

## Next Steps

After implementing this feature:
1. Run `/speckit.tasks` to generate implementation tasks
2. Follow TDD: Write tests → Implement → Verify
3. Test on both Windows + Linux (multiplatform requirement)
4. Verify XSS safety (malicious markdown input)
5. Performance test with 50k character responses
6. Accessibility test (keyboard navigation, screen readers)

## Resources

- [react-markdown docs](https://github.com/remarkjs/react-markdown)
- [remark-gfm plugin](https://github.com/remarkjs/remark-gfm)
- [rehype-highlight plugin](https://github.com/rehypejs/rehype-highlight)
- [React Flow NodeResizer](https://reactflow.dev/api-reference/components/node-resizer)
- Feature 007/008 specs (existing LLM infrastructure)
