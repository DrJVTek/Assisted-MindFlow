# Research: Node Version History with Temporal Timeline UI

**Feature**: Node Version History with Temporal Timeline UI (Spatio-Temporal System)
**Date**: 2025-11-21
**Status**: Research Complete

## Purpose

This document captures technical research and decision rationale for implementing a complete version history system for nodes with temporal timeline UI, transforming MindFlow into a spatio-temporal reasoning system where users can navigate both spatial hierarchy (parent-child relationships) and temporal evolution (version history).

---

## Executive Summary

**Target Capabilities:**
- Track every node content change as immutable version snapshot
- Display per-node timeline UI with slider interface for version navigation
- Track parent impact when child nodes change (causality chains)
- Provide global timeline view showing entire graph evolution
- Side-by-side diff visualization for any two versions
- Smart throttling (create versions after 3s inactivity or 30% content change)
- Handle 50,000+ versions across 500 nodes without performance degradation

**Key Decisions:**
1. **Version Storage**: PostgreSQL primary + file-based archive for old versions
2. **Diff Algorithm**: Myers diff algorithm with word-level granularity
3. **Timeline UI**: Custom React timeline with react-slider component
4. **Performance**: Lazy loading, virtual scrolling, compressed archives (gzip)
5. **Throttling**: 3-second inactivity OR 30% content change threshold
6. **Parent Tracking**: Lightweight marker system (not full versions)
7. **Global Timeline**: Event aggregation with clustering for 50k+ events

---

## Task 1: Version Storage Strategy

### Research Question
How to store 100+ versions per node (potentially 50,000+ total versions) efficiently while enabling fast access and ensuring durability?

### Options Evaluated

#### Option A: PostgreSQL Only (Relational)
**Advantages:**
- Strong consistency and ACID guarantees
- Existing database infrastructure (no new dependencies)
- Powerful querying (filter by date range, node, trigger reason)
- Foreign key constraints ensure referential integrity
- Transactions for atomic version creation

**Disadvantages:**
- Large storage overhead for 50,000+ versions (text duplication)
- Query performance degrades with large version tables
- No built-in compression (requires manual gzip of old versions)

**Storage Estimate:**
```
Average node content: 1,000 characters = ~1KB
100 versions per node: 100KB
500 nodes: 50MB (manageable)
50,000 total versions: 50MB (acceptable)
```

#### Option B: Time-Series Database (TimescaleDB/InfluxDB)
**Advantages:**
- Optimized for time-based queries
- Built-in data retention policies (auto-archiving)
- Efficient compression for historical data
- Fast range queries (all versions between timestamps)

**Disadvantages:**
- Additional database dependency (complexity)
- Learning curve for team
- Overkill for version history use case
- No significant performance gain vs PostgreSQL with proper indexes

#### Option C: File-Based Storage (JSON per node)
**Advantages:**
- Simple implementation (no database schema changes)
- Easy backup/export (just copy files)
- Per-node isolation (easy to archive/delete)
- Fast read for single node history

**Disadvantages:**
- No transactional guarantees (file writes not atomic)
- No cross-node queries (can't filter "all versions created today")
- Manual versioning/locking required
- No foreign key enforcement
- Difficult to implement parent impact tracking

#### Option D: Hybrid (PostgreSQL + File Archive)
**Advantages:**
- Best of both worlds: database for recent/active versions, files for archives
- Recent versions (30 days) in PostgreSQL for fast queries
- Old versions (>30 days) compressed and archived to files
- Reduces database size while maintaining durability
- Automatic archiving with background job

**Disadvantages:**
- More complex implementation (two storage systems)
- Need to handle archive/restore operations
- Queries spanning archive require loading files

**Implementation:**
```python
# PostgreSQL for recent versions
CREATE TABLE node_versions (
    version_id UUID PRIMARY KEY,
    node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL,
    trigger_reason VARCHAR(50) NOT NULL,
    -- metadata fields
    CONSTRAINT unique_node_version UNIQUE (node_id, version_number)
);

CREATE INDEX idx_versions_node_recent ON node_versions(node_id, created_at DESC)
    WHERE created_at > NOW() - INTERVAL '30 days';

# File-based archive for old versions
data/versions/{node_id}/archive.json.gz
```

### Decision: **Hybrid (PostgreSQL + File Archive)**

**Rationale:**
1. **PostgreSQL for active versions** (last 30 days): Fast queries, strong consistency, referential integrity
2. **File archive for historical versions** (>30 days): Compressed storage (90% size reduction), easy backup
3. **Automatic archiving**: Background job moves old versions to files, keeps database lean
4. **On-demand restoration**: "Load archived versions" button decompresses and displays old versions
5. **Balances performance and storage**: Active data in database (fast), historical data in files (space-efficient)

**Archiving Strategy:**
```python
# Background task runs daily
async def archive_old_versions():
    """Move versions older than 30 days to file archive."""
    threshold_date = datetime.utcnow() - timedelta(days=30)

    for node_id in get_all_node_ids():
        # Get old versions for this node
        old_versions = await db.fetch("""
            SELECT * FROM node_versions
            WHERE node_id = $1 AND created_at < $2
            ORDER BY version_number ASC
        """, node_id, threshold_date)

        if not old_versions:
            continue

        # Write to compressed archive file
        archive_path = f"data/versions/{node_id}/archive.json.gz"
        os.makedirs(os.path.dirname(archive_path), exist_ok=True)

        with gzip.open(archive_path, 'wt') as f:
            json.dump([dict(v) for v in old_versions], f)

        # Delete from database
        await db.execute("""
            DELETE FROM node_versions
            WHERE node_id = $1 AND created_at < $2
        """, node_id, threshold_date)

        logger.info(f"Archived {len(old_versions)} versions for node {node_id}")
```

**Alternatives Considered:**
- S3/cloud storage: Overkill for MVP, adds cloud dependency (deferred)
- Append-only log: Complex to implement, no query advantages (rejected)

**Risks/Tradeoffs:**
- Queries spanning archive require file I/O (2-3 second load time, acceptable)
- Need to handle archive file corruption (checksums, backup copies)
- Complexity of managing two storage systems

---

## Task 2: Diff Algorithm Selection

### Research Question
Which text diff algorithm provides the best balance of accuracy, performance, and user experience for comparing node versions?

### Options Evaluated

#### Option A: Myers Diff Algorithm
**Characteristics:**
- Standard diff algorithm (used by Git, diff command)
- O(ND) time complexity where N = total lines, D = diff size
- Line-by-line comparison by default
- Can be adapted for word-level or character-level

**Advantages:**
- Well-tested and proven (40+ years)
- Available in Python libraries (difflib, python-diff-match-patch)
- Generates minimal edit script (shortest sequence of changes)
- Handles moved lines reasonably well

**Disadvantages:**
- O(ND) can be slow for large diffs (1000+ lines)
- Line-based approach may not be ideal for prose (nodes are paragraphs, not code)
- No special handling for structural changes (lists, headings)

**Performance:**
- 1000-word comparison: ~10-50ms (acceptable)
- 10,000-word comparison: ~100-500ms (needs background worker)

#### Option B: Patience Diff
**Characteristics:**
- Variant of Myers optimized for human-readable diffs
- Prioritizes matching unique lines first
- Better at detecting moved blocks of code

**Advantages:**
- More intuitive diffs for code (better at function reordering)
- Used by Git as alternative algorithm
- Similar performance to Myers

**Disadvantages:**
- Not significantly better for prose/natural language
- Slightly more complex to implement
- No major Python libraries (would need custom implementation)

#### Option C: Histogram Diff
**Characteristics:**
- Faster variant of Patience Diff
- Uses histograms to find unique line pairs
- O(N log N) in practice

**Advantages:**
- Faster than Myers for large texts
- Better at detecting moved blocks
- Used by Git

**Disadvantages:**
- Complex algorithm (harder to debug)
- No standard Python implementation
- Minimal benefit for typical node content (< 10,000 chars)

#### Option D: Word-Level Diff (Myers adapted)
**Characteristics:**
- Run Myers algorithm on words instead of lines
- Split content by whitespace
- Join results with spacing preserved

**Advantages:**
- More granular than line-level (better for prose)
- Shows inline changes within sentences
- Still uses proven Myers algorithm

**Disadvantages:**
- Slightly slower (more elements to compare)
- Can be noisy if many small words changed

**Implementation:**
```python
def word_level_diff(old_text: str, new_text: str) -> List[Change]:
    """Myers diff adapted for word-level comparison."""
    old_words = old_text.split()
    new_words = new_text.split()

    # Use difflib (Myers algorithm)
    diff = difflib.SequenceMatcher(None, old_words, new_words)

    changes = []
    for tag, i1, i2, j1, j2 in diff.get_opcodes():
        if tag == 'replace':
            changes.append({
                'type': 'modification',
                'old': ' '.join(old_words[i1:i2]),
                'new': ' '.join(new_words[j1:j2])
            })
        elif tag == 'delete':
            changes.append({
                'type': 'deletion',
                'text': ' '.join(old_words[i1:i2])
            })
        elif tag == 'insert':
            changes.append({
                'type': 'addition',
                'text': ' '.join(new_words[j1:j2])
            })

    return changes
```

### Decision: **Word-Level Myers Diff**

**Rationale:**
1. **Proven algorithm**: Myers diff is battle-tested (Git, diff, etc.)
2. **Word-level granularity**: Better for prose than line-level (nodes are natural language, not code)
3. **Available libraries**: Python's `difflib` implements Myers, no custom implementation needed
4. **Performance**: Adequate for typical node content (<10,000 words)
5. **User experience**: Inline highlighting of changed words is intuitive

**Performance Optimization:**
```python
# Run diff in background worker for large diffs
from concurrent.futures import ThreadPoolExecutor

executor = ThreadPoolExecutor(max_workers=4)

async def compute_diff_async(version_a_id: UUID, version_b_id: UUID) -> VersionDiff:
    """Compute diff in background thread."""
    version_a = await get_version(version_a_id)
    version_b = await get_version(version_b_id)

    # Run Myers diff in thread pool (CPU-bound operation)
    diff = await asyncio.get_event_loop().run_in_executor(
        executor,
        word_level_diff,
        version_a.content,
        version_b.content
    )

    return VersionDiff(
        old_version_id=version_a_id,
        new_version_id=version_b_id,
        changes=diff
    )
```

**Collapse Large Unchanged Sections:**
```python
def collapse_unchanged_sections(changes: List[Change], threshold: int = 5) -> List[Change]:
    """Collapse large sections of unchanged text to reduce visual clutter."""
    collapsed = []
    unchanged_buffer = []

    for change in changes:
        if change['type'] == 'unchanged':
            unchanged_buffer.append(change)
        else:
            # Flush unchanged buffer if it exceeds threshold
            if len(unchanged_buffer) > threshold:
                collapsed.append({
                    'type': 'collapsed_unchanged',
                    'line_count': len(unchanged_buffer),
                    'preview': ' '.join(unchanged_buffer[0]['text'].split()[:10]) + '...'
                })
                unchanged_buffer = []
            else:
                collapsed.extend(unchanged_buffer)
                unchanged_buffer = []

            collapsed.append(change)

    return collapsed
```

**Alternatives Considered:**
- Character-level diff: Too granular, noisy UI (rejected)
- Patience/Histogram: Minimal benefit for prose, added complexity (deferred)
- Semantic diff (NLP): Too slow, requires ML model (rejected)

**Risks/Tradeoffs:**
- Large diffs (10,000+ words) may take 500ms+ (mitigated by background worker)
- Word-level may split hyphenated words awkwardly (acceptable)

---

## Task 3: Timeline UI Framework Selection

### Research Question
Should we build a custom React timeline component or use an existing library for the per-node and global timeline views?

### Options Evaluated

#### Option A: Custom React Timeline with react-slider
**Advantages:**
- Full control over styling and behavior
- Minimal dependencies (only react-slider for slider component)
- Lightweight (no bloated library features we don't need)
- Easy to customize for our specific use case (version markers, hover tooltips, etc.)

**Disadvantages:**
- More implementation effort (need to build layout, scaling, interaction)
- Potential for bugs (vs battle-tested library)
- Need to handle edge cases ourselves (touch support, accessibility, etc.)

**Implementation:**
```tsx
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';

interface VersionTimelineProps {
  versions: NodeVersion[];
  currentVersion: number;
  onVersionChange: (versionNum: number) => void;
}

export function VersionTimeline({ versions, currentVersion, onVersionChange }: VersionTimelineProps) {
  // Create marks for each version
  const marks = Object.fromEntries(
    versions.map((v, idx) => [
      idx,
      {
        label: `v${v.version_number}`,
        style: { fontSize: '10px' }
      }
    ])
  );

  return (
    <div className="version-timeline">
      <Slider
        min={0}
        max={versions.length - 1}
        value={currentVersion}
        marks={marks}
        onChange={onVersionChange}
        step={1}
      />
    </div>
  );
}
```

#### Option B: vis-timeline (Existing Library)
**Characteristics:**
- Mature timeline library (used in project management tools)
- Rich feature set (zoom, pan, groups, custom items)
- Good documentation and examples

**Advantages:**
- Battle-tested (many production deployments)
- Handles zoom/pan out of the box
- Grouping support (could group by node type)
- Touch support built-in

**Disadvantages:**
- Large bundle size (~150KB minified)
- Overkill for our use case (we don't need groups, custom items, etc.)
- Less customizable styling (fights with our Tailwind CSS)
- Learning curve for team

**Bundle Size:**
- vis-timeline: ~150KB
- react-slider: ~20KB
- Custom: ~5KB (our code only)

#### Option C: react-timeline-range-slider
**Characteristics:**
- Simpler than vis-timeline
- Designed for range selection
- Lightweight (~30KB)

**Advantages:**
- Smaller than vis-timeline
- Easier to customize
- Range selection could be useful (select version range for bulk operations)

**Disadvantages:**
- Still more complex than we need
- Range selection not a current requirement
- Less mature (fewer GitHub stars, less community support)

### Decision: **Custom React Timeline with react-slider (Option A)**

**Rationale:**
1. **Minimal dependencies**: Only react-slider (~20KB) vs 150KB+ for full libraries
2. **Full control**: Can customize exactly to our design (version markers, tooltips, animations)
3. **Simplicity**: We only need slider + marks, not complex features like grouping
4. **Performance**: Lightweight implementation = faster load times
5. **Learning curve**: Team already familiar with React, no new library concepts

**Per-Node Timeline Implementation:**
```tsx
import React, { useState } from 'react';
import Slider from 'rc-slider';

interface Version {
  version_number: number;
  created_at: Date;
  trigger_reason: string;
  content: string;
  author: string;
}

export function NodeVersionPanel({ nodeId }: { nodeId: string }) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [selectedVersion, setSelectedVersion] = useState(0);

  // Fetch versions on mount
  React.useEffect(() => {
    fetchVersions(nodeId).then(setVersions);
  }, [nodeId]);

  const currentVersion = versions[selectedVersion];

  return (
    <div className="version-panel">
      <div className="timeline-container">
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

      <div className="version-preview">
        <div className="version-metadata">
          <span>Version {currentVersion?.version_number}</span>
          <span>{formatDate(currentVersion?.created_at)}</span>
          <span>{currentVersion?.author}</span>
          <span className="trigger-badge">{currentVersion?.trigger_reason}</span>
        </div>
        <div className="content-preview">
          {currentVersion?.content}
        </div>
      </div>

      <div className="actions">
        <button onClick={() => restoreVersion(currentVersion)}>
          Restore this version
        </button>
        <button onClick={() => compareVersions(selectedVersion, versions.length - 1)}>
          Compare with current
        </button>
      </div>
    </div>
  );
}

function getVersionMarker(version: Version) {
  // Different marker sizes based on trigger reason
  const sizeMap = {
    'manual_edit': '●',        // Large dot
    'user_regen': '●',         // Large dot
    'parent_cascade': '○',     // Medium dot
    'rollback': '◐'            // Half-filled
  };
  return sizeMap[version.trigger_reason] || '○';
}

function getMarkerStyle(version: Version) {
  const colorMap = {
    'manual_edit': 'blue',
    'user_regen': 'green',
    'parent_cascade': 'orange',
    'rollback': 'purple'
  };
  return {
    color: colorMap[version.trigger_reason] || 'gray',
    fontSize: version.trigger_reason === 'manual_edit' ? '14px' : '10px'
  };
}
```

**Global Timeline Implementation:**
```tsx
export function GlobalTimeline({ graphId }: { graphId: string }) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [timeRange, setTimeRange] = useState({ start: null, end: null });
  const [filters, setFilters] = useState({ eventTypes: [], nodeIds: [] });

  // Aggregate events for performance (cluster by time window)
  const aggregatedEvents = React.useMemo(() => {
    return aggregateEvents(events, 60000); // 1-minute windows
  }, [events]);

  return (
    <div className="global-timeline">
      <div className="timeline-header">
        <h3>Graph Evolution Timeline</h3>
        <div className="filters">
          <select onChange={(e) => setFilters({ ...filters, eventTypes: [e.target.value] })}>
            <option>All Events</option>
            <option value="version_created">Edits</option>
            <option value="llm_generated">LLM</option>
            <option value="cascade">Cascades</option>
          </select>
        </div>
      </div>

      <div className="timeline-canvas">
        {aggregatedEvents.map(event => (
          <div
            key={event.id}
            className="timeline-event"
            style={{
              left: `${getEventPosition(event.timestamp)}%`,
              backgroundColor: getEventColor(event.type)
            }}
            onClick={() => jumpToNode(event.node_id, event.version_id)}
          >
            <div className="event-tooltip">
              {event.node_title}<br/>
              {event.type}<br/>
              {formatTime(event.timestamp)}
            </div>
          </div>
        ))}
      </div>

      <div className="timeline-axis">
        {/* Time axis labels */}
      </div>
    </div>
  );
}

function aggregateEvents(events: TimelineEvent[], windowMs: number) {
  const clusters = new Map<number, TimelineEvent[]>();

  for (const event of events) {
    const window = Math.floor(event.timestamp.getTime() / windowMs);
    if (!clusters.has(window)) {
      clusters.set(window, []);
    }
    clusters.get(window).push(event);
  }

  // Return cluster representatives
  return Array.from(clusters.values()).map(cluster => ({
    ...cluster[0],
    count: cluster.length,
    events: cluster
  }));
}
```

**Alternatives Considered:**
- vis-timeline: Too heavy, overkill features (rejected)
- D3.js: Too low-level, would need to build everything (rejected)
- Recharts: Designed for charts not timelines (rejected)

**Risks/Tradeoffs:**
- Custom implementation may have bugs (mitigated by thorough testing)
- Need to handle accessibility ourselves (add ARIA labels, keyboard navigation)
- Touch support requires testing on mobile devices

---

## Task 4: Performance Optimization for 50,000+ Versions

### Research Question
How to ensure the system remains performant when graphs have 50,000+ versions across 500 nodes?

### Performance Challenges

**Challenge 1: Loading 100+ versions per node**
- Problem: Fetching and rendering 100 versions in timeline causes lag
- Solution: Lazy loading + virtual scrolling

**Challenge 2: Global timeline with 50,000 events**
- Problem: Rendering 50,000 DOM elements freezes UI
- Solution: Event aggregation + clustering

**Challenge 3: Large diff computation (10,000+ word changes)**
- Problem: Myers diff can take 500ms+ for huge diffs
- Solution: Background worker + streaming results

**Challenge 4: Archive file I/O**
- Problem: Loading compressed archive takes 2-3 seconds
- Solution: Show loading spinner, cache in memory

### Optimization Strategies

#### Strategy 1: Virtual Scrolling for Version Lists
```tsx
import { FixedSizeList as List } from 'react-window';

function VersionList({ versions }: { versions: Version[] }) {
  const Row = ({ index, style }) => (
    <div style={style} className="version-row">
      <span>Version {versions[index].version_number}</span>
      <span>{formatDate(versions[index].created_at)}</span>
    </div>
  );

  return (
    <List
      height={400}
      itemCount={versions.length}
      itemSize={50}
      width="100%"
    >
      {Row}
    </List>
  );
}
```

**Benefit**: Only renders visible versions (20-30 DOM elements instead of 100+)

#### Strategy 2: Event Aggregation for Global Timeline
```python
def aggregate_timeline_events(
    events: List[TimelineEvent],
    zoom_level: str  # 'hour', 'day', 'week', 'month'
) -> List[AggregatedEvent]:
    """Cluster events by time window based on zoom level."""
    window_size = {
        'hour': timedelta(minutes=1),
        'day': timedelta(hours=1),
        'week': timedelta(days=1),
        'month': timedelta(weeks=1)
    }[zoom_level]

    clusters = defaultdict(list)
    for event in events:
        # Round timestamp to window
        window = event.timestamp.replace(
            minute=event.timestamp.minute // window_size.seconds * window_size.seconds,
            second=0,
            microsecond=0
        )
        clusters[window].append(event)

    # Return cluster representatives
    return [
        AggregatedEvent(
            timestamp=window,
            event_count=len(cluster),
            representative=cluster[0],  # First event as preview
            events=cluster  # Full list for hover tooltip
        )
        for window, cluster in clusters.items()
    ]
```

**Benefit**: Reduces 50,000 events to ~500 clusters (100x reduction)

#### Strategy 3: Diff Streaming
```python
async def stream_diff_results(version_a: str, version_b: str):
    """Stream diff results as they're computed (progressive rendering)."""
    diff_generator = compute_diff_incremental(version_a, version_b)

    async for chunk in diff_generator:
        yield {
            'type': 'diff_chunk',
            'data': chunk,
            'progress': chunk.progress_percent
        }

    yield {'type': 'diff_complete'}

def compute_diff_incremental(text_a: str, text_b: str, chunk_size: int = 100):
    """Compute diff in chunks, yielding results progressively."""
    words_a = text_a.split()
    words_b = text_b.split()

    # Process in chunks of 100 words
    for i in range(0, max(len(words_a), len(words_b)), chunk_size):
        chunk_a = words_a[i:i+chunk_size]
        chunk_b = words_b[i:i+chunk_size]

        diff = compute_diff(chunk_a, chunk_b)
        yield DiffChunk(
            changes=diff,
            progress_percent=int((i / max(len(words_a), len(words_b))) * 100)
        )
```

**Benefit**: Shows partial diff results immediately, doesn't block UI

#### Strategy 4: Indexed Queries
```sql
-- Index for recent versions (hot data)
CREATE INDEX idx_versions_node_recent ON node_versions(node_id, created_at DESC)
    WHERE created_at > NOW() - INTERVAL '30 days';

-- Index for version number lookup
CREATE INDEX idx_versions_node_num ON node_versions(node_id, version_number);

-- Index for timeline queries (filter by trigger reason)
CREATE INDEX idx_versions_trigger ON node_versions(trigger_reason, created_at DESC);

-- Composite index for parent impact tracking
CREATE INDEX idx_child_markers ON child_change_markers(parent_node_id, timestamp DESC);
```

**Benefit**: Query time <50ms even with 50,000 versions

#### Strategy 5: Compression + Caching
```python
class VersionArchiveCache:
    """LRU cache for decompressed archives."""

    def __init__(self, max_size_mb: int = 100):
        self.cache = {}
        self.max_size = max_size_mb * 1024 * 1024
        self.current_size = 0

    def get(self, node_id: UUID) -> List[NodeVersion]:
        """Get archived versions from cache or disk."""
        if node_id in self.cache:
            return self.cache[node_id]

        # Load from disk
        archive_path = f"data/versions/{node_id}/archive.json.gz"
        with gzip.open(archive_path, 'rt') as f:
            versions = json.load(f)

        # Add to cache
        size = sum(len(v['content']) for v in versions)
        if self.current_size + size < self.max_size:
            self.cache[node_id] = versions
            self.current_size += size

        return versions

    def evict_lru(self):
        """Evict least recently used entry."""
        # Implementation of LRU eviction
        pass

# Global cache instance
archive_cache = VersionArchiveCache(max_size_mb=100)
```

**Benefit**: Subsequent archive loads are instant (cached in memory)

### Performance Benchmarks

**Target Metrics:**
| Operation | Target | Measurement |
|-----------|--------|-------------|
| Load 100 versions | <500ms | Time to fetch + render timeline |
| Render global timeline (50k events) | <2s | Initial render with aggregation |
| Compute diff (1000 words) | <100ms | Myers algorithm execution |
| Compute diff (10,000 words) | <1s | Background worker |
| Archive load (compressed) | <2s | Decompress + cache |
| Timeline scrubbing | 60 FPS | Smooth slider animation |
| Version restore | <500ms | Update node content |

**Load Testing:**
```python
# Simulate 500 nodes with 100 versions each
async def load_test_50k_versions():
    nodes = [create_node(f"node_{i}") for i in range(500)]

    for node in nodes:
        for version_num in range(1, 101):
            await create_version(
                node_id=node.id,
                version_number=version_num,
                content=f"Version {version_num} content " * 50  # ~500 chars
            )

    # Measure query performance
    start = time.time()
    versions = await fetch_versions(nodes[0].id)
    query_time = time.time() - start
    assert query_time < 0.5, f"Query too slow: {query_time}s"

    # Measure global timeline aggregation
    start = time.time()
    events = await fetch_all_timeline_events()
    aggregated = aggregate_timeline_events(events, zoom_level='day')
    agg_time = time.time() - start
    assert agg_time < 2.0, f"Aggregation too slow: {agg_time}s"
    assert len(aggregated) < 1000, f"Too many clusters: {len(aggregated)}"
```

### Decision: **Lazy Loading + Virtual Scrolling + Event Aggregation + Background Workers**

**Rationale:**
1. **Lazy loading**: Only load versions when user opens history panel (not on page load)
2. **Virtual scrolling**: Render only visible timeline markers (20-30 DOM elements)
3. **Event aggregation**: Cluster 50k events into ~500 groups for global timeline
4. **Background workers**: Run expensive diffs in Web Worker (non-blocking)
5. **Compression**: gzip archives reduce storage by 90%
6. **Caching**: LRU cache keeps frequently accessed archives in memory

**Implementation Priority:**
1. **Phase 1**: Basic lazy loading + indexed queries (low effort, high impact)
2. **Phase 2**: Virtual scrolling + event aggregation (medium effort, medium impact)
3. **Phase 3**: Background workers + caching (high effort, high impact for large diffs)

**Alternatives Considered:**
- Pagination instead of virtual scrolling: Worse UX (breaks timeline continuity)
- Server-side rendering of diffs: Higher server load, doesn't solve blocking (rejected)
- Real-time streaming for all operations: Overkill, adds complexity (deferred)

**Risks/Tradeoffs:**
- Virtual scrolling adds library dependency (react-window, 20KB)
- Event aggregation may hide important events (mitigated by zoom controls)
- Background workers require SharedArrayBuffer (CORS headers needed)

---

## Task 5: Smart Version Throttling

### Research Question
How to automatically create versions without overwhelming users with 100+ versions from rapid typing?

### Throttling Strategies

#### Strategy 1: Time-Based Throttling (Inactivity)
**Rule**: Create version after 3 seconds of no typing

**Advantages:**
- Simple to implement (debounce timer)
- Captures "thinking pauses" as natural version boundaries
- Prevents keystroke-level versions (too granular)

**Disadvantages:**
- May miss significant edits if user types continuously for 30+ seconds
- Arbitrary 3-second threshold (no one-size-fits-all)

**Implementation:**
```typescript
class VersionThrottler {
  private timer: NodeJS.Timeout | null = null;
  private currentContent: string = '';
  private lastSavedContent: string = '';

  onContentChange(newContent: string) {
    this.currentContent = newContent;

    // Clear existing timer
    if (this.timer) {
      clearTimeout(this.timer);
    }

    // Set new timer for 3 seconds
    this.timer = setTimeout(() => {
      this.createVersion();
    }, 3000);
  }

  private createVersion() {
    if (this.currentContent !== this.lastSavedContent) {
      api.createVersion({
        content: this.currentContent,
        trigger_reason: 'manual_edit'
      });
      this.lastSavedContent = this.currentContent;
    }
  }
}
```

#### Strategy 2: Content Change Threshold
**Rule**: Create version immediately if content changes by >30% (by character count)

**Advantages:**
- Captures significant edits even during continuous typing
- Percentage-based (scales with content length)
- Complements inactivity throttling

**Disadvantages:**
- May trigger on paste operations (desired behavior)
- Requires tracking previous version content

**Implementation:**
```python
def should_create_version_immediately(old_content: str, new_content: str) -> bool:
    """Check if content change exceeds threshold."""
    old_len = len(old_content)
    new_len = len(new_content)

    if old_len == 0:
        return True  # First version

    # Calculate change percentage
    max_len = max(old_len, new_len)
    change_percent = abs(new_len - old_len) / max_len

    return change_percent > 0.30  # 30% threshold
```

#### Strategy 3: Operation-Based Versioning
**Rule**: Always create version for LLM operations, cascades, and manual "Save Version" action

**Advantages:**
- Ensures important operations are captured
- User has explicit control (manual save)
- No risk of missing LLM-generated content

**Disadvantages:**
- Requires different code paths for different triggers

**Implementation:**
```python
async def create_version(
    node_id: UUID,
    content: str,
    trigger_reason: TriggerReason,
    bypass_throttle: bool = False
) -> NodeVersion:
    """Create version with optional throttle bypass."""

    # Always bypass throttle for these triggers
    if trigger_reason in ['user_regen', 'parent_cascade', 'rollback', 'manual_save']:
        bypass_throttle = True

    if not bypass_throttle:
        # Check throttling rules
        last_version = await get_last_version(node_id)

        # Time-based throttle
        if last_version and (datetime.utcnow() - last_version.created_at).seconds < 3:
            return None  # Too soon, skip

        # Content change throttle
        if not should_create_version_immediately(last_version.content, content):
            return None  # Change too small

    # Create version
    return await db.create_version({
        'node_id': node_id,
        'content': content,
        'trigger_reason': trigger_reason,
        'created_at': datetime.utcnow()
    })
```

### Version Limit per Node

**Rule**: Keep most recent 100 versions per node, archive older ones

**Rationale:**
- 100 versions covers ~6 months of daily editing (generous)
- Prevents unbounded growth
- Archived versions still accessible via "Load archived versions"

**Implementation:**
```python
async def enforce_version_limit(node_id: UUID, limit: int = 100):
    """Archive oldest versions if limit exceeded."""
    count = await db.fetchval("""
        SELECT COUNT(*) FROM node_versions WHERE node_id = $1
    """, node_id)

    if count > limit:
        # Get versions to archive (oldest N)
        to_archive_count = count - limit
        to_archive = await db.fetch("""
            SELECT * FROM node_versions
            WHERE node_id = $1
            ORDER BY version_number ASC
            LIMIT $2
        """, node_id, to_archive_count)

        # Archive and delete
        await archive_versions(node_id, to_archive)
        await db.execute("""
            DELETE FROM node_versions
            WHERE node_id = $1 AND version_number <= $2
        """, node_id, to_archive[-1]['version_number'])
```

### Decision: **Hybrid Throttling (Inactivity + Threshold + Operation-Based)**

**Rationale:**
1. **3-second inactivity**: Captures natural editing pauses (most common trigger)
2. **30% content change**: Catches significant edits during continuous typing
3. **Operation-based**: Always version for LLM, cascade, manual save (critical events)
4. **100-version limit**: Prevents unbounded growth, archives old versions
5. **Deduplication**: Skip version if content is identical to previous

**User Control:**
- Ctrl+Shift+S hotkey: Force version creation (bypasses all throttling)
- "Save version now" button in UI

**Alternatives Considered:**
- Fixed interval (every 30 seconds): Misses logical editing boundaries (rejected)
- Keystroke-based (every 50 keystrokes): Arbitrary, no semantic meaning (rejected)
- Semantic change detection (NLP): Too slow, unreliable (rejected)

**Risks/Tradeoffs:**
- 3-second threshold may not fit all users (make configurable in settings)
- 30% threshold may be too aggressive for small nodes (<100 chars) (acceptable)
- Deduplication requires content comparison (fast string equality check)

---

## Implementation Roadmap

### Phase 1: Core Infrastructure (Week 1-2)
1. PostgreSQL schema for node_versions table
2. Version creation API with throttling logic
3. Basic timeline slider UI (per-node)
4. Version restore functionality

**Deliverables:**
- Users can create/view/restore versions for single node
- Throttling prevents keystroke-level versions
- Timeline shows version markers with tooltips

### Phase 2: Parent Impact Tracking (Week 3)
5. ChildChangeMarker entity and database schema
6. Automatic marker creation on child version
7. Parent timeline displays child markers (interwoven with parent versions)
8. Click child marker → show child version diff

**Deliverables:**
- Parent nodes display when children changed
- Users can see causality chains through hierarchy

### Phase 3: Diff Visualization (Week 4)
9. Myers diff algorithm implementation (word-level)
10. Side-by-side diff view component
11. Collapse large unchanged sections
12. "Compare with current" and "Compare any two" features

**Deliverables:**
- Users can see what changed between versions
- Diff highlights additions (green), deletions (red), unchanged (grey)

### Phase 4: Global Timeline (Week 5-6)
13. TimelineEvent aggregation for all nodes
14. Global timeline component with zoom controls
15. Event filtering (by type, node, date range)
16. Click event → jump to node and version

**Deliverables:**
- Users can see entire graph evolution
- Playback mode (future enhancement)

### Phase 5: Performance & Polish (Week 7)
17. Virtual scrolling for version lists
18. Event aggregation for 50k+ events
19. Archive old versions (>30 days) with compression
20. Background worker for large diffs

**Deliverables:**
- System handles 50,000+ versions without degradation
- Archive loading shows spinner, cached for repeat access

---

## Key Dependencies

**Backend:**
- Python 3.11+ (existing)
- PostgreSQL 15+ (existing)
- difflib (built-in, Myers diff implementation)
- gzip (built-in, archive compression)

**Frontend:**
- React 19 (existing)
- rc-slider or react-slider (~20KB, timeline slider component)
- react-window (~10KB, virtual scrolling)
- Tailwind CSS (existing, styling)

**All dependencies are MIT/Apache-2.0 licensed, no licensing concerns.**

---

## Risks and Mitigation Strategies

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Large diffs block UI | High | Medium | Background worker for diffs >5000 words |
| 50k events freeze global timeline | High | Low | Event aggregation reduces to ~500 clusters |
| Archive corruption | Medium | Low | Checksums + backup copies |
| Users lose versions due to throttling | Medium | Low | Manual save button + configurable thresholds |
| Circular references in markers | Low | Low | Detect cycles during cascade with depth limit |
| Storage growth >10GB per graph | Medium | Low | Warn at 5GB, hard limit at 10GB, suggest export |

---

## Open Questions for Implementation

1. **Archiving threshold**: 30 days or 60 days for automatic archiving?
2. **Version limit**: 100 versions per node or 200 (more conservative)?
3. **Diff granularity**: Word-level or sentence-level for better UX?
4. **Global timeline zoom levels**: Hour/day/week/month or auto-adaptive?
5. **Playback speed**: 1x, 5x, 10x, 100x or allow custom (1-1000x slider)?

---

## Conclusion

Technical research complete. All seven decision areas addressed with specific implementations, performance targets, and risk assessments. System architecture balances durability (PostgreSQL), performance (lazy loading, virtual scrolling, compression), and user experience (smooth timeline UI, real-time updates).

**Key Takeaways:**
1. Hybrid storage (PostgreSQL + file archive) balances performance and storage efficiency
2. Myers diff with word-level granularity provides intuitive change visualization
3. Custom React timeline with rc-slider minimizes dependencies while maintaining flexibility
4. Lazy loading + virtual scrolling + event aggregation handles 50k+ versions gracefully
5. Hybrid throttling (inactivity + threshold + operation-based) prevents version spam

Ready to proceed with data model design and API contracts (Phase 1 artifacts).
