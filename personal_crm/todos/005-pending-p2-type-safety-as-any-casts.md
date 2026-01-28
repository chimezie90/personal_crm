---
status: pending
priority: p2
issue_id: "005"
tags: [code-review, typescript, type-safety]
dependencies: []
---

# Type Safety Erosion from `as any` Casts

## Problem Statement

Multiple instances of `as any` casting bypass TypeScript's type safety, particularly in the sync actions where source types are cast without validation.

## Findings

**Location:** `src/actions/sync.actions.ts`

```typescript
// Line 29
type: sourceType as any,

// Line 76
await findOrCreateContact(rawContact, sourceType as any)

// Line 88
source: sourceType as any,

// Lines 110-111
source: sourceType as any,
type: sourceType as any,
```

**Risk:** Invalid source types could cause runtime errors or unexpected behavior.

## Proposed Solutions

### Option A: Type Guard Function (Recommended)
**Pros:** Runtime validation, type narrowing
**Cons:** None
**Effort:** Small
**Risk:** Low

```typescript
// Add to src/lib/connectors/types.ts
const DATA_SOURCE_TYPES = ["imessage", "whatsapp", "facebook", "email", "phone"] as const;

export function isDataSourceType(s: string): s is DataSourceType {
  return DATA_SOURCE_TYPES.includes(s as DataSourceType);
}

// In sync.actions.ts
export async function syncDataSource(sourceType: string): Promise<SyncResult> {
  if (!isDataSourceType(sourceType)) {
    return {
      success: false,
      contactsImported: 0,
      messagesImported: 0,
      error: `Invalid source type: ${sourceType}`
    };
  }

  // Now sourceType is properly typed as DataSourceType
  const config: ConnectorConfig = {
    type: sourceType,  // No cast needed
    // ...
  };
}
```

## Recommended Action

Option A - Add type guard and validate at function entry.

## Technical Details

**Affected files:**
- `src/actions/sync.actions.ts`
- `src/lib/connectors/types.ts`

## Acceptance Criteria

- [ ] Type guard function `isDataSourceType` created
- [ ] All `as any` casts removed from sync.actions.ts
- [ ] Invalid source types return error instead of crashing
- [ ] TypeScript compiler happy with no casts

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-28 | Created from code review | Pattern recognition specialist identified type safety issues |

## Resources

- TypeScript type guards: https://www.typescriptlang.org/docs/handbook/2/narrowing.html
