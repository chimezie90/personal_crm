---
status: pending
priority: p1
issue_id: "004"
tags: [code-review, performance, memory, imessage]
dependencies: []
---

# iMessage Connector Loads All Results Into Memory

## Problem Statement

Despite using async generators, the iMessage connector calls `stmt.all()` which loads ALL rows into memory at once. For users with hundreds of thousands of messages, this causes massive memory spikes and potential OOM crashes.

## Findings

**Location:** `src/lib/connectors/imessage/connector.ts:161-186`

```typescript
async *fetchMessages(since?: Date): AsyncGenerator<RawMessage> {
  const stmt = this.db.prepare(GET_MESSAGES_SINCE_QUERY);
  // ALL rows loaded at once, then iterated
  const rows = stmt.all(sinceTime) as IMessageRow[];

  for (const row of rows) {
    yield parseMessageRow(row);
  }
}
```

**Memory Impact:**
- 100,000 messages at ~2KB each: ~200MB spike
- 500,000 messages: ~1GB allocation
- Node.js heap limit may be exceeded

## Proposed Solutions

### Option A: Use iterate() for streaming (Recommended)
**Pros:** O(1) memory, streams rows one at a time
**Cons:** None - better-sqlite3 supports this natively
**Effort:** Small
**Risk:** Low

```typescript
async *fetchMessages(since?: Date): AsyncGenerator<RawMessage> {
  if (!this.db) {
    throw new Error("Connector not initialized");
  }

  const sinceTime = since
    ? Math.floor(since.getTime() / 1000) - APPLE_EPOCH_OFFSET
    : 0;

  const stmt = this.db.prepare(GET_MESSAGES_SINCE_QUERY);

  // Stream rows instead of loading all at once
  for (const row of stmt.iterate(sinceTime)) {
    const message = parseMessageRow(row as IMessageRow);
    if (message) {
      yield message;
    }
  }
}
```

Same fix needed for `fetchContacts()`:

```typescript
async *fetchContacts(): AsyncGenerator<RawContact> {
  if (!this.db) {
    throw new Error("Connector not initialized");
  }

  const stmt = this.db.prepare(GET_CONTACTS_QUERY);

  // Stream instead of all()
  for (const row of stmt.iterate()) {
    const contact = parseContactRow(row as IMessageContactRow);
    if (contact) {
      yield contact;
    }
  }
}
```

## Recommended Action

Option A - Use `stmt.iterate()` instead of `stmt.all()` for both fetchMessages and fetchContacts.

## Technical Details

**Affected files:**
- `src/lib/connectors/imessage/connector.ts`

**Expected improvement:** Memory usage from O(n) to O(1), enables processing unlimited message volumes.

## Acceptance Criteria

- [ ] `fetchMessages` uses `stmt.iterate()` instead of `stmt.all()`
- [ ] `fetchContacts` uses `stmt.iterate()` instead of `stmt.all()`
- [ ] Memory stays constant regardless of result count
- [ ] Sync still works correctly with streaming

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-28 | Created from code review | Performance oracle identified memory issue |

## Resources

- better-sqlite3 iterate: https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md#iteratebindparameters---iterator
