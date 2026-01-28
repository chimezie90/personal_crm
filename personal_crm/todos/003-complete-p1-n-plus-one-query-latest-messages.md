---
status: pending
priority: p1
issue_id: "003"
tags: [code-review, performance, database, n-plus-one]
dependencies: []
---

# N+1 Query in getLatestMessagesPerContact

## Problem Statement

The `getLatestMessagesPerContact` function executes a separate database query for each contact, causing O(n) queries where n is the number of contacts. With 500 contacts, this means 500 separate database round trips.

## Findings

**Location:** `src/lib/services/message-service.ts:125-143`

```typescript
export async function getLatestMessagesPerContact(
  contactIds: string[]
): Promise<Record<string, Message>> {
  const result: Record<string, Message> = {};

  // N+1 QUERY - Each contact triggers a separate database query
  for (const contactId of contactIds) {
    const message = await db.message.findFirst({
      where: { contactId },
      orderBy: { timestamp: "desc" },
    });
    if (message) {
      result[contactId] = dbRowToMessage(message);
    }
  }
  return result;
}
```

**Performance Impact:**
- 50 contacts: 50 queries (~200ms)
- 500 contacts: 500 queries (~2-5s)
- 1000 contacts: Potential timeout

## Proposed Solutions

### Option A: Prisma distinct (Recommended)
**Pros:** Single query, uses Prisma API
**Cons:** None
**Effort:** Small
**Risk:** Low

```typescript
export async function getLatestMessagesPerContact(
  contactIds: string[]
): Promise<Record<string, Message>> {
  if (contactIds.length === 0) return {};

  const messages = await db.message.findMany({
    where: { contactId: { in: contactIds } },
    orderBy: { timestamp: "desc" },
    distinct: ["contactId"],
  });

  const result: Record<string, Message> = {};
  for (const message of messages) {
    result[message.contactId] = dbRowToMessage(message);
  }
  return result;
}
```

### Option B: Raw SQL with window function
**Pros:** Most efficient for large datasets
**Cons:** Requires raw SQL, less portable
**Effort:** Medium
**Risk:** Low

## Recommended Action

Option A - Prisma distinct is clean and efficient for typical use cases.

## Technical Details

**Affected files:**
- `src/lib/services/message-service.ts`

**Expected improvement:** O(n) queries reduced to O(1), ~50-100x faster.

## Acceptance Criteria

- [ ] Single database query regardless of contact count
- [ ] Returns correct latest message for each contact
- [ ] Handles empty contactIds array
- [ ] Performance test shows <100ms for 500 contacts

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-28 | Created from code review | Performance oracle identified N+1 pattern |

## Resources

- Prisma distinct: https://www.prisma.io/docs/concepts/components/prisma-client/distinct
