# Quickstart: Node Version History with Temporal Timeline UI

**Feature Branch**: `009-node-version-history`
**Last Updated**: 2025-11-21
**Status**: Implementation Guide

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Demo](#quick-demo)
3. [Key Components](#key-components)
4. [Implementation Phases](#implementation-phases)
5. [Testing Checklist](#testing-checklist)
6. [Common Issues & Solutions](#common-issues--solutions)
7. [API Reference](#api-reference)

---

## Overview

This feature transforms MindFlow from a spatial reasoning system into a **spatio-temporal reasoning system** by adding complete version history tracking for nodes with temporal timeline UI.

**Key Capabilities:**
1. **Immutable Version History**: Every content change captured as version snapshot
2. **Per-Node Timeline UI**: Slider interface for navigating version history
3. **Parent Impact Tracking**: Child changes create markers in parent timeline (causality)
4. **Global Timeline View**: See entire graph evolution over time
5. **Version Diff**: Side-by-side comparison with Myers algorithm
6. **Smart Throttling**: Automatic version creation without spam (3s inactivity or 30% change)
7. **Performance**: Handles 50,000+ versions across 500 nodes

---

## Quick Demo

### Scenario 1: Version Navigation

```
1. User creates question node: "What is the best database?"
2. User types content, pauses 3 seconds
   → Version 1 created automatically
3. User edits content, pauses 3 seconds
   → Version 2 created
4. User clicks history icon on node
   → Timeline panel opens showing slider with 2 versions
5. User drags slider to version 1
   → Content preview updates to show version 1
6. User clicks "Restore this version"
   → Node content reverts to version 1, creates version 3 (rollback)
```

### Scenario 2: Parent Impact Tracking

```
1. User creates parent question: "What is the best database?"
2. User creates child hypothesis: "PostgreSQL is best"
3. User edits child content to "MongoDB is best"
   → Child version 2 created
   → Parent timeline shows child change marker (orange diamond)
4. User clicks child marker in parent timeline
   → Modal shows child version diff (before/after)
5. User decides to regenerate parent based on child change
   → Parent version 2 created with cascade metadata
```

### Scenario 3: Global Timeline

```
1. Graph has 10 nodes with 50 versions total
2. User clicks "Global Timeline" button in toolbar
3. Timeline shows horizontal view with all 50 events
4. User clicks event marker for node 3's version 2
5. Canvas pans to node 3, opens history at version 2
```

---

## Key Components

### 1. Backend: VersionService (Python)

**Location**: `src/mindflow/services/version_service.py` (new)

```python
from datetime import datetime, timedelta
from uuid import UUID, uuid4
from typing import List, Optional
from ..models.graph import NodeVersion

class VersionService:
    """Manages node version lifecycle and throttling."""

    def __init__(self, db):
        self.db = db
        self.inactivity_threshold = 3  # seconds
        self.change_threshold = 0.30   # 30%

    async def create_version(
        self,
        node_id: UUID,
        content: str,
        trigger_reason: str,
        bypass_throttle: bool = False,
        **kwargs
    ) -> Optional[NodeVersion]:
        """Create version with smart throttling."""

        # Always bypass throttle for these triggers
        if trigger_reason in ['user_regen', 'parent_cascade', 'rollback', 'manual_save']:
            bypass_throttle = True

        if not bypass_throttle:
            # Get last version
            last_version = await self.db.get_last_version(node_id)

            if last_version:
                # Time-based throttle
                time_since_last = (datetime.utcnow() - last_version.created_at).seconds
                if time_since_last < self.inactivity_threshold:
                    return None  # Too soon, skip

                # Content change throttle
                if not self._exceeds_change_threshold(last_version.content, content):
                    return None  # Change too small

        # Create version
        version_number = await self.db.get_next_version_number(node_id)

        version = NodeVersion(
            version_id=uuid4(),
            node_id=node_id,
            version_number=version_number,
            content=content,
            word_count=len(content.split()),
            char_count=len(content),
            trigger_reason=trigger_reason,
            author='LLM' if trigger_reason == 'user_regen' else 'human',
            **kwargs
        )

        await self.db.create_version(version)

        # Check version limit and archive if needed
        await self._enforce_version_limit(node_id, limit=100)

        # Create child markers in parent nodes
        if trigger_reason != 'parent_cascade':
            await self._create_parent_markers(node_id, version.version_id)

        return version

    def _exceeds_change_threshold(self, old_content: str, new_content: str) -> bool:
        """Check if content change exceeds 30% threshold."""
        old_len = len(old_content)
        new_len = len(new_content)

        if old_len == 0:
            return True

        max_len = max(old_len, new_len)
        change_percent = abs(new_len - old_len) / max_len

        return change_percent > self.change_threshold

    async def _create_parent_markers(self, child_node_id: UUID, child_version_id: UUID):
        """Create ChildChangeMarker in all parent nodes."""
        # Get parent nodes
        parents = await self.db.get_parent_nodes(child_node_id)

        for parent in parents:
            marker = ChildChangeMarker(
                marker_id=uuid4(),
                parent_node_id=parent.id,
                child_node_id=child_node_id,
                child_version_id=child_version_id,
                timestamp=datetime.utcnow(),
                marker_type='direct_child_change',
                cascade_depth=1,
                child_node_title=await self.db.get_node_title(child_node_id),
                child_content_preview=content[:200]
            )

            await self.db.create_child_marker(marker)

    async def _enforce_version_limit(self, node_id: UUID, limit: int = 100):
        """Archive oldest versions if limit exceeded."""
        count = await self.db.count_versions(node_id)

        if count > limit:
            to_archive_count = count - limit
            versions_to_archive = await self.db.fetch_oldest_versions(
                node_id, to_archive_count
            )

            # Archive to file
            await self._archive_versions(node_id, versions_to_archive)

            # Delete from database
            await self.db.delete_versions([v.version_id for v in versions_to_archive])
```

---

### 2. Backend: DiffService (Python)

**Location**: `src/mindflow/services/diff_service.py` (new)

```python
import difflib
from typing import List, Dict
from uuid import UUID

class DiffService:
    """Computes word-level diffs using Myers algorithm."""

    async def compute_diff(
        self,
        version_a_id: UUID,
        version_b_id: UUID
    ) -> VersionDiff:
        """Compute diff between two versions."""
        # Fetch versions
        version_a = await db.get_version(version_a_id)
        version_b = await db.get_version(version_b_id)

        # Split into words
        words_a = version_a.content.split()
        words_b = version_b.content.split()

        # Use difflib (Myers algorithm)
        differ = difflib.SequenceMatcher(None, words_a, words_b)

        changes = []
        for tag, i1, i2, j1, j2 in differ.get_opcodes():
            if tag == 'replace':
                changes.append({
                    'type': 'modification',
                    'old_text': ' '.join(words_a[i1:i2]),
                    'new_text': ' '.join(words_b[j1:j2]),
                    'start_pos': i1,
                    'end_pos': i2
                })
            elif tag == 'delete':
                changes.append({
                    'type': 'deletion',
                    'text': ' '.join(words_a[i1:i2]),
                    'start_pos': i1,
                    'end_pos': i2
                })
            elif tag == 'insert':
                changes.append({
                    'type': 'addition',
                    'text': ' '.join(words_b[j1:j2]),
                    'start_pos': j1,
                    'end_pos': j2
                })
            elif tag == 'equal':
                # Collapse large unchanged sections
                if i2 - i1 > 5:
                    changes.append({
                        'type': 'collapsed_unchanged',
                        'text': f"... {i2 - i1} unchanged words ...",
                        'start_pos': i1,
                        'end_pos': i2
                    })
                else:
                    changes.append({
                        'type': 'unchanged',
                        'text': ' '.join(words_a[i1:i2]),
                        'start_pos': i1,
                        'end_pos': i2
                    })

        return VersionDiff(
            old_version_id=version_a_id,
            new_version_id=version_b_id,
            changes=changes,
            word_count_delta=len(words_b) - len(words_a),
            char_count_delta=len(version_b.content) - len(version_a.content),
            additions_count=sum(1 for c in changes if c['type'] == 'addition'),
            deletions_count=sum(1 for c in changes if c['type'] == 'deletion'),
            modifications_count=sum(1 for c in changes if c['type'] == 'modification')
        )
```

---

### 3. Frontend: VersionTimeline Component (React)

**Location**: `frontend/src/components/VersionTimeline.tsx` (new)

```tsx
import React, { useState, useEffect } from 'react';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';

interface VersionTimelineProps {
  nodeId: string;
}

export function VersionTimeline({ nodeId }: VersionTimelineProps) {
  const [versions, setVersions] = useState<NodeVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVersions();
  }, [nodeId]);

  const fetchVersions = async () => {
    const response = await fetch(`/api/nodes/${nodeId}/versions`);
    const data = await response.json();
    setVersions(data.versions);
    setSelectedVersion(data.versions.length - 1); // Start at latest
    setLoading(false);
  };

  const currentVersion = versions[selectedVersion];

  const handleRestore = async () => {
    await fetch(
      `/api/nodes/${nodeId}/versions/${currentVersion.version_number}/restore`,
      { method: 'POST' }
    );
    await fetchVersions(); // Reload to show new rollback version
  };

  const handleCompare = async () => {
    // Open diff modal comparing selected version with current
    const latestVersion = versions[versions.length - 1];
    const response = await fetch(`/api/nodes/${nodeId}/versions/diff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        version_a_number: currentVersion.version_number,
        version_b_number: latestVersion.version_number
      })
    });
    const diff = await response.json();
    // Show diff modal with result
  };

  if (loading) return <div>Loading history...</div>;

  if (versions.length === 0) {
    return <div>No version history yet</div>;
  }

  return (
    <div className="version-timeline-panel">
      <div className="timeline-header">
        <h3>Version History</h3>
        <span>{versions.length} versions</span>
      </div>

      <div className="timeline-slider">
        <Slider
          min={0}
          max={versions.length - 1}
          value={selectedVersion}
          onChange={setSelectedVersion}
          marks={Object.fromEntries(
            versions.map((v, idx) => [
              idx,
              {
                label: getVersionMarker(v),
                style: getMarkerStyle(v)
              }
            ])
          )}
        />
      </div>

      <div className="version-metadata">
        <span className="version-number">Version {currentVersion.version_number}</span>
        <span className="timestamp">{formatDate(currentVersion.created_at)}</span>
        <span className={`trigger-badge ${currentVersion.trigger_reason}`}>
          {currentVersion.trigger_reason}
        </span>
        <span className="author">{currentVersion.author}</span>
      </div>

      <div className="content-preview">
        <div className="preview-label">Content at this version:</div>
        <div className="preview-content">{currentVersion.content}</div>
      </div>

      <div className="actions">
        <button
          onClick={handleRestore}
          disabled={selectedVersion === versions.length - 1}
        >
          Restore this version
        </button>
        <button onClick={handleCompare}>
          Compare with current
        </button>
      </div>
    </div>
  );
}

function getVersionMarker(version: NodeVersion): string {
  const markers = {
    'manual_edit': '●',
    'user_regen': '●',
    'parent_cascade': '○',
    'rollback': '◐',
    'manual_save': '●'
  };
  return markers[version.trigger_reason] || '○';
}

function getMarkerStyle(version: NodeVersion) {
  const colors = {
    'manual_edit': 'blue',
    'user_regen': 'green',
    'parent_cascade': 'orange',
    'rollback': 'purple',
    'manual_save': 'blue'
  };

  return {
    color: colors[version.trigger_reason] || 'gray',
    fontSize: ['manual_edit', 'user_regen'].includes(version.trigger_reason) ? '14px' : '10px'
  };
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 60) return `${diffMins} minutes ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hours ago`;
  return date.toLocaleDateString();
}
```

---

### 4. Frontend: VersionDiff Component (React)

**Location**: `frontend/src/components/VersionDiff.tsx` (new)

```tsx
import React from 'react';

interface VersionDiffProps {
  diff: VersionDiff;
  versionA: NodeVersion;
  versionB: NodeVersion;
}

export function VersionDiff({ diff, versionA, versionB }: VersionDiffProps) {
  return (
    <div className="version-diff-modal">
      <div className="diff-header">
        <div className="version-info left">
          <h4>Version {versionA.version_number}</h4>
          <span>{formatDate(versionA.created_at)}</span>
          <span>{versionA.word_count} words</span>
        </div>
        <div className="diff-arrow">→</div>
        <div className="version-info right">
          <h4>Version {versionB.version_number}</h4>
          <span>{formatDate(versionB.created_at)}</span>
          <span>{versionB.word_count} words</span>
          <span className="delta">
            {diff.word_count_delta > 0 ? '+' : ''}{diff.word_count_delta} words
          </span>
        </div>
      </div>

      <div className="diff-stats">
        <span className="additions">+{diff.additions_count} additions</span>
        <span className="deletions">-{diff.deletions_count} deletions</span>
        <span className="modifications">~{diff.modifications_count} changes</span>
      </div>

      <div className="diff-content">
        {diff.changes.map((change, idx) => (
          <DiffChangeBlock key={idx} change={change} />
        ))}
      </div>
    </div>
  );
}

function DiffChangeBlock({ change }: { change: DiffChange }) {
  switch (change.type) {
    case 'addition':
      return <span className="diff-addition">{change.text}</span>;
    case 'deletion':
      return <span className="diff-deletion">{change.text}</span>;
    case 'modification':
      return (
        <span className="diff-modification">
          <span className="old">{change.old_text}</span>
          <span className="new">{change.new_text}</span>
        </span>
      );
    case 'collapsed_unchanged':
      return (
        <details className="diff-collapsed">
          <summary>{change.text}</summary>
        </details>
      );
    default:
      return <span className="diff-unchanged">{change.text}</span>;
  }
}
```

---

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1)
**Goal**: Basic version tracking and storage

1. Create PostgreSQL schema for `node_versions` table
2. Implement `VersionService` with throttling logic
3. Add version creation API endpoint
4. Basic timeline slider UI (per-node)

**Deliverables:**
- ✅ Users can manually create versions
- ✅ Throttling prevents keystroke-level versions
- ✅ Timeline shows version markers

**Testing:**
- Create node, type content, wait 3 seconds → verify version created
- Type rapidly (<3s between changes) → verify only 1 version created

---

### Phase 2: Timeline UI & Navigation (Week 2)
**Goal**: Complete per-node timeline interface

5. Implement version restore (rollback)
6. Add version preview in timeline
7. Polish timeline UI (tooltips, animations)
8. Add "Load archived versions" button

**Deliverables:**
- ✅ Users can navigate version history with slider
- ✅ Users can restore previous versions
- ✅ Archived versions (>30 days) accessible

**Testing:**
- Create 10 versions, drag slider through history → verify preview updates
- Restore version 3 → verify content reverts, version 11 created

---

### Phase 3: Parent Impact Tracking (Week 3)
**Goal**: Causality chain visualization

9. Create `child_change_markers` table
10. Automatic marker creation on child version
11. Display markers in parent timeline
12. Click marker → show child diff modal

**Deliverables:**
- ✅ Parent timeline shows when children changed
- ✅ Users can see child change diffs from parent

**Testing:**
- Create parent+child, edit child → verify marker appears in parent timeline
- Click marker → verify child diff displayed

---

### Phase 4: Diff Visualization (Week 4)
**Goal**: Version comparison with Myers diff

13. Implement Myers diff algorithm (word-level)
14. Create VersionDiff component
15. "Compare versions" feature
16. Collapse large unchanged sections

**Deliverables:**
- ✅ Users can compare any two versions
- ✅ Diff highlights additions/deletions/modifications

**Testing:**
- Compare versions with small changes (10 words) → verify accurate highlighting
- Compare versions with large changes (1000 words) → verify performance <500ms

---

### Phase 5: Global Timeline (Week 5)
**Goal**: Graph-wide temporal view

17. Create timeline aggregation service
18. Global timeline UI component
19. Event filtering (by type, node, date)
20. Click event → jump to node

**Deliverables:**
- ✅ Users can see entire graph evolution
- ✅ Filters enable focused temporal analysis

**Testing:**
- Create 50 versions across 10 nodes → verify global timeline displays all events
- Filter by "LLM operations" → verify only LLM versions shown

---

### Phase 6: Performance & Polish (Week 6)
**Goal**: Handle 50,000+ versions

21. Implement version archiving (>30 days)
22. Virtual scrolling for large version lists
23. Event clustering for global timeline
24. Performance optimization and profiling

**Deliverables:**
- ✅ System handles 50,000 versions without degradation
- ✅ All operations meet performance targets

**Testing:**
- Load test: 500 nodes × 100 versions = 50,000 total → verify <2s global timeline load

---

## Testing Checklist

### Unit Tests

```python
# tests/unit/test_version_service.py

def test_version_throttling_inactivity():
    """Verify version created after 3s inactivity."""
    # Create version, wait 2s, attempt another → should be throttled
    # Wait 3s, attempt again → should succeed

def test_version_throttling_content_change():
    """Verify version created on 30% content change."""
    # Create version with 100 chars
    # Change to 135 chars (35% change) → should create immediately

def test_rollback_creates_new_version():
    """Verify restoring version creates new version, not destructive."""
    # Create versions 1, 2, 3
    # Restore version 1 → should create version 4 with parent_version_id=1

def test_child_marker_creation():
    """Verify child change creates marker in parent."""
    # Create parent+child
    # Edit child → verify marker created in parent's markers table
```

### Integration Tests

```python
# tests/integration/test_version_api.py

async def test_version_timeline_api():
    """Test full version timeline workflow."""
    # POST /nodes/{id}/versions × 5 (create 5 versions)
    # GET /nodes/{id}/versions → verify 5 versions returned
    # POST /nodes/{id}/versions/{num}/restore → verify rollback

async def test_diff_computation():
    """Test diff API endpoint."""
    # Create 2 versions with known differences
    # POST /nodes/{id}/versions/diff
    # Verify response contains expected changes
```

### Manual Testing

1. **Single Node History**
   - [ ] Create node, type content, verify automatic version creation
   - [ ] Open history panel, drag slider, verify preview updates
   - [ ] Restore previous version, verify content reverts and new version created

2. **Parent Impact Tracking**
   - [ ] Create parent+child, edit child
   - [ ] Verify orange diamond marker appears in parent timeline
   - [ ] Click marker, verify child diff modal opens

3. **Global Timeline**
   - [ ] Create 10 nodes with 50 versions total
   - [ ] Open global timeline, verify all events displayed
   - [ ] Click event, verify canvas jumps to node and opens history

4. **Performance**
   - [ ] Create 100 versions for one node, measure load time (<500ms)
   - [ ] Compute diff between large versions (1000+ words), measure (<100ms)

---

## Common Issues & Solutions

### Issue: Version not created after typing

**Symptom**: User types content but no version appears in timeline

**Solution**: Check throttling rules
- Must wait 3 seconds of inactivity OR change content by 30%
- Verify backend logs show throttling decision
- Force version creation with "Save version" button

---

### Issue: Diff computation slow (>1s)

**Symptom**: Comparing large versions takes too long

**Solution**: Implement background worker
```python
# Run diff in thread pool
import asyncio
from concurrent.futures import ThreadPoolExecutor

executor = ThreadPoolExecutor(max_workers=4)

async def compute_diff_async(version_a, version_b):
    diff = await asyncio.get_event_loop().run_in_executor(
        executor,
        compute_diff_sync,
        version_a.content,
        version_b.content
    )
    return diff
```

---

### Issue: Timeline slider laggy

**Symptom**: Dragging slider causes frame drops

**Solution**: Debounce preview updates
```tsx
const debouncedPreview = useMemo(
  () => debounce((versionNum: number) => {
    loadVersionPreview(versionNum);
  }, 100),
  []
);

// In slider onChange
onChange={(value) => {
  setSelectedVersion(value);
  debouncedPreview(value);
}}
```

---

## API Reference

### Create Version
```http
POST /api/nodes/{node_id}/versions
Content-Type: application/json

{
  "content": "Updated node content",
  "trigger_reason": "manual_edit",
  "bypass_throttle": false
}

Response (201):
{
  "version_id": "uuid",
  "version_number": 5,
  "created_at": "2025-11-21T10:30:00Z",
  ...
}
```

### List Versions
```http
GET /api/nodes/{node_id}/versions?include_archived=false

Response (200):
{
  "versions": [...],
  "total_count": 42,
  "has_archived": true
}
```

### Compute Diff
```http
POST /api/nodes/{node_id}/versions/diff
Content-Type: application/json

{
  "version_a_number": 2,
  "version_b_number": 5
}

Response (200):
{
  "diff": {
    "changes": [...],
    "word_count_delta": 15,
    "additions_count": 20,
    "deletions_count": 5
  },
  "version_a": {...},
  "version_b": {...}
}
```

---

## Next Steps

1. **Start with Phase 1**: Implement core version tracking infrastructure
2. **Test thoroughly**: Unit tests for throttling, integration tests for API
3. **Iterate on UI**: Get feedback on timeline slider usability
4. **Performance testing**: Load test with 50,000 versions
5. **Documentation**: Update user guide with version history features

**Target completion**: 6 weeks (Phases 1-6)

---

## Additional Resources

- **Data Model**: See `data-model.md` for detailed entity schemas
- **Feature Spec**: See `spec.md` for complete requirements
- **Implementation Plan**: See `plan.md` for project structure and architecture
- **API Contracts**: See `contracts/api-version-history.yaml` for OpenAPI specification

---

**Questions?** Review the spec.md or check Common Issues section above.
