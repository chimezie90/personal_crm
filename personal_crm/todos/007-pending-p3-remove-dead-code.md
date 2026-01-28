---
status: pending
priority: p3
issue_id: "007"
tags: [code-review, cleanup, dead-code]
dependencies: []
---

# Remove ~141 LOC of Dead Code

## Problem Statement

Multiple unused functions, interfaces, and duplicate code exist in the codebase. This adds maintenance burden and cognitive load.

## Findings

| File | Lines | Description | LOC |
|------|-------|-------------|-----|
| `src/lib/connectors/imessage/parser.ts` | 64-90 | Unused `normalizeIdentifier` function | 26 |
| `src/lib/connectors/imessage/queries.ts` | 17-34 | Unused `GET_MESSAGES_QUERY` | 18 |
| `src/lib/result.ts` | 17-37 | Unused `isOk`, `isErr`, `unwrap`, `unwrapOr` | 21 |
| `src/lib/connectors/registry.ts` | 59-71 | Unused `getRegisteredTypes`, `isTypeRegistered` | 13 |
| `src/lib/connectors/types.ts` | 59-63 | Unused `CallProvider` interface | 5 |
| `src/lib/connectors/base-connector.ts` | 89-96 | Unused `supportssCalls` function (also has typo) | 8 |
| `src/lib/services/deduplication-service.ts` | 166-208 | Unused `findPotentialDuplicates` | 43 |
| `src/components/dashboard/activity-feed.tsx` | 14-20 | Duplicate `sourceIcons` (use getSourceIcon instead) | 7 |

**Total:** ~141 lines of dead code

## Proposed Solutions

### Option A: Remove All Dead Code
**Pros:** Cleaner codebase, easier maintenance
**Cons:** May need to re-add if features are built later
**Effort:** Small
**Risk:** Low

Simply delete the identified code blocks.

## Recommended Action

Remove all dead code. If needed later, git history preserves it.

## Technical Details

**Affected files:**
- `src/lib/connectors/imessage/parser.ts`
- `src/lib/connectors/imessage/queries.ts`
- `src/lib/result.ts`
- `src/lib/connectors/registry.ts`
- `src/lib/connectors/types.ts`
- `src/lib/connectors/base-connector.ts`
- `src/lib/services/deduplication-service.ts`
- `src/components/dashboard/activity-feed.tsx`

## Acceptance Criteria

- [ ] All unused functions removed
- [ ] All unused interfaces removed
- [ ] Duplicate sourceIcons removed, uses getSourceIcon
- [ ] Build still passes
- [ ] No import errors

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-28 | Created from code review | Simplicity reviewer identified dead code |

## Resources

- Git history for recovery if needed
