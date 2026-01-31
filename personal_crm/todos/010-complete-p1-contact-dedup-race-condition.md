---
status: pending
priority: p1
issue_id: "010"
tags: [data-integrity, code-review, import-feature]
dependencies: []
---

# Race Condition in Contact Deduplication

## Problem Statement

The `findOrCreateContact` function performs a check-then-act pattern without transaction protection. Between checking if a contact exists and creating a new one, another concurrent import could create the same contact, resulting in duplicate contacts.

## Findings

**Location:** `src/lib/services/deduplication-service.ts`, lines 49-79

**Evidence:**
```typescript
export async function findOrCreateContact(
  rawContact: RawContact,
  source: DataSourceType
): Promise<string> {
  const existingId = await findMatchingContact(rawContact);  // Step 1: Check

  if (existingId) {
    await addIdentityToContact(existingId, rawContact.identifier, source);
    return existingId;
  }

  // RACE WINDOW: Another process can create the same contact here

  const contact = await db.contact.create({  // Step 2: Create
    data: { ... }
  });

  return contact.id;
}
```

**Data Corruption Scenario:**
1. Import A and Import B both process contact "john@example.com" simultaneously
2. Both call `findMatchingContact` and get `null`
3. Both proceed to create a new contact
4. Result: Two separate contact records for the same person

## Proposed Solutions

### Option A: Serializable Transaction (Recommended)
- **Pros:** Proper isolation
- **Cons:** May reduce throughput
- **Effort:** Medium
- **Risk:** Low

```typescript
await db.$transaction(async (tx) => {
  const existingId = await findMatchingContact(rawContact, tx);
  if (existingId) {
    await addIdentityToContact(existingId, rawContact.identifier, source, tx);
    return existingId;
  }
  const contact = await tx.contact.create({ ... });
  return contact.id;
}, { isolationLevel: 'Serializable' });
```

### Option B: Unique Constraint + Upsert
- **Pros:** Database enforces uniqueness
- **Cons:** Requires schema change
- **Effort:** High
- **Risk:** Medium

## Recommended Action

[Leave blank - to be filled during triage]

## Technical Details

**Affected Files:**
- `src/lib/services/deduplication-service.ts`

**Components:** Contact Deduplication Service

## Acceptance Criteria

- [ ] Concurrent contact creation doesn't create duplicates
- [ ] Transaction isolation prevents race conditions
- [ ] Tests verify concurrent import safety

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-29 | Created from data integrity review | SQLite supports serializable transactions |

## Resources

- PR: Current branch `feat/dashboard-redesign`
- Data Integrity Guardian Review
