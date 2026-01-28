---
status: pending
priority: p1
issue_id: "002"
tags: [code-review, data-integrity, prisma, database]
dependencies: []
---

# Missing Transaction Boundaries in Merge Operations

## Problem Statement

The `mergeContacts` operation performs multiple database operations without a transaction. If the final delete fails, messages will have been reassigned to a contact that still has a duplicate, leaving the database in an inconsistent state.

## Findings

**Location:** `src/lib/services/deduplication-service.ts:115-164`

```typescript
// Step 1 - Update messages
await db.message.updateMany({
  where: { contactId: sourceId },
  data: { contactId: targetId },
});

// Step 2 - Merge identities and update contact
await db.contact.update({
  where: { id: targetId },
  data: { identities: JSON.stringify(mergedIdentities) },
});

// Step 3 - Delete source contact (if this fails, data is inconsistent!)
await db.contact.delete({
  where: { id: sourceId },
});
```

**Risk:** HIGH - Data corruption if any step fails partway through.

## Proposed Solutions

### Option A: Prisma Transaction (Recommended)
**Pros:** Simple, built-in, automatic rollback
**Cons:** None
**Effort:** Small
**Risk:** Low

```typescript
export async function mergeContacts(
  targetId: string,
  sourceId: string
): Promise<void> {
  await db.$transaction(async (tx) => {
    // Get both contacts
    const [target, source] = await Promise.all([
      tx.contact.findUnique({ where: { id: targetId } }),
      tx.contact.findUnique({ where: { id: sourceId } }),
    ]);

    if (!target || !source) {
      throw new Error("Contact not found");
    }

    // Merge identities
    const targetIdentities = parseIdentities(target.identities);
    const sourceIdentities = parseIdentities(source.identities);
    const mergedIdentities = [...targetIdentities];

    for (const identity of sourceIdentities) {
      if (!mergedIdentities.some(i =>
        i.type === identity.type && i.value === identity.value
      )) {
        mergedIdentities.push(identity);
      }
    }

    // All operations in transaction
    await tx.message.updateMany({
      where: { contactId: sourceId },
      data: { contactId: targetId },
    });

    await tx.contact.update({
      where: { id: targetId },
      data: { identities: JSON.stringify(mergedIdentities) },
    });

    await tx.contact.delete({
      where: { id: sourceId },
    });
  });
}
```

## Recommended Action

Option A - Use Prisma's built-in transaction support.

## Technical Details

**Affected files:**
- `src/lib/services/deduplication-service.ts`

## Acceptance Criteria

- [ ] Merge operation is wrapped in `db.$transaction()`
- [ ] All database operations use transaction client (`tx`)
- [ ] Failure in any step rolls back entire operation
- [ ] Test verifies rollback behavior on error

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-28 | Created from code review | Architecture review identified missing atomicity |

## Resources

- Prisma Transactions: https://www.prisma.io/docs/concepts/components/prisma-client/transactions
