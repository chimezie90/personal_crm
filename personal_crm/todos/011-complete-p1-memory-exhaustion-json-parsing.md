---
status: complete
priority: p1
issue_id: "011"
tags: [performance, code-review, import-feature]
dependencies: []
---

# Memory Exhaustion in Facebook/Instagram JSON Parsing

## Problem Statement

The Facebook and Instagram parsers load entire JSON files into memory using `readFile` and `JSON.parse`. For large exports (100-500MB), this causes memory exhaustion:
- `readFile` loads entire file into buffer
- `JSON.parse` creates full data structure
- Encoding fix creates additional copies
- Peak memory: ~3-4x file size

## Findings

**Location:**
- `src/lib/connectors/facebook/parser.ts:80-84`
- `src/lib/connectors/instagram/parser.ts:82-86`

**Evidence:**
```typescript
export async function parseFacebookMessageFile(
  filePath: string
): Promise<FBConversation> {
  const content = await readFile(filePath, "utf-8");  // Full file in memory
  const data = JSON.parse(content) as FBConversation;  // Full structure
```

**Impact at Scale:**
| File Size | Peak Memory | Result |
|-----------|-------------|--------|
| 100 MB    | ~400 MB     | Degraded performance |
| 500 MB    | ~2 GB       | Process may crash |
| 1 GB+     | ~4 GB       | Guaranteed crash |

## Proposed Solutions

### Option A: Streaming JSON Parser (Recommended)
- **Pros:** Constant memory usage regardless of file size
- **Cons:** More complex implementation
- **Effort:** High
- **Risk:** Low

```typescript
import { parser } from 'stream-json';
import { streamArray } from 'stream-json/streamers/StreamArray';

export async function* parseMessagesStreaming(filePath: string): AsyncGenerator<FBMessage> {
  const pipeline = createReadStream(filePath)
    .pipe(parser())
    .pipe(pick({ filter: 'messages' }))
    .pipe(streamArray());

  for await (const { value } of pipeline) {
    yield fixMessageEncoding(value);
  }
}
```

### Option B: Reduce Max File Size
- **Pros:** Simple
- **Cons:** Limits functionality
- **Effort:** Low
- **Risk:** High (user frustration)

## Recommended Action

[Leave blank - to be filled during triage]

## Technical Details

**Affected Files:**
- `src/lib/connectors/facebook/parser.ts`
- `src/lib/connectors/instagram/parser.ts`

**Dependencies to Add:**
- `stream-json` - Streaming JSON parsing

## Acceptance Criteria

- [x] 500MB exports can be imported without memory issues
- [x] Memory usage stays under 500MB during import
- [x] Import speed is comparable to current implementation

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-29 | Created from performance review | stream-json is the recommended library |
| 2026-01-31 | Implemented streaming JSON parser | Used stream-json with pick/streamArray for messages, streamObject for metadata |

## Resources

- PR: Current branch `feat/dashboard-redesign`
- Performance Oracle Review
- npm: stream-json
