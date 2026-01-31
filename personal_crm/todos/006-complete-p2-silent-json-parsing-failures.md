---
status: pending
priority: p2
issue_id: "006"
tags: [code-review, data-integrity, error-handling]
dependencies: []
---

# Silent Data Loss from JSON Parsing Failures

## Problem Statement

JSON parsing functions silently return empty arrays/objects when parsing fails, hiding data corruption and making debugging difficult.

## Findings

**Location:** `src/schemas/contact.schema.ts:57-66`

```typescript
export function parseIdentities(json: string): Identity[] {
  try {
    const parsed = JSON.parse(json);
    return z.array(identitySchema).parse(parsed);
  } catch {
    return [];  // Silent failure - data loss hidden!
  }
}

export function parseTags(json: string): string[] {
  try {
    return JSON.parse(json);
  } catch {
    return [];  // Silent failure
  }
}
```

**Location:** `src/schemas/message.schema.ts:46-52`

```typescript
export function parseMetadata(json: string): Record<string, unknown> {
  try {
    return JSON.parse(json);
  } catch {
    return {};  // Silent failure
  }
}
```

**Risk:** Data corruption goes unnoticed, contacts may appear to have no identities when they actually have corrupted data.

## Proposed Solutions

### Option A: Log Warnings (Recommended for MVP)
**Pros:** Non-breaking, surfaces issues
**Cons:** Still allows empty returns
**Effort:** Small
**Risk:** Low

```typescript
export function parseIdentities(json: string): Identity[] {
  try {
    const parsed = JSON.parse(json);
    return z.array(identitySchema).parse(parsed);
  } catch (error) {
    console.warn(`Failed to parse identities JSON: ${json.slice(0, 100)}...`, error);
    return [];
  }
}
```

### Option B: Return Result type (Better long-term)
**Pros:** Explicit error handling, forces callers to handle
**Cons:** Breaking change to API
**Effort:** Medium
**Risk:** Medium

```typescript
import { Result, ok, err } from "@/lib/result";

export function parseIdentities(json: string): Result<Identity[]> {
  try {
    const parsed = JSON.parse(json);
    const validated = z.array(identitySchema).safeParse(parsed);
    if (!validated.success) {
      return err(new Error(`Invalid identities: ${validated.error.message}`));
    }
    return ok(validated.data);
  } catch (e) {
    return err(new Error(`Failed to parse identities JSON: ${e}`));
  }
}
```

## Recommended Action

Option A for immediate fix, consider Option B for future refactoring.

## Technical Details

**Affected files:**
- `src/schemas/contact.schema.ts`
- `src/schemas/message.schema.ts`

## Acceptance Criteria

- [ ] JSON parsing failures are logged with context
- [ ] Original JSON (truncated) is included in log
- [ ] Error details are preserved
- [ ] Application still functions with corrupted data (graceful degradation)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-28 | Created from code review | Architecture review identified silent failures |

## Resources

- Zod safeParse: https://zod.dev/?id=safeparse
