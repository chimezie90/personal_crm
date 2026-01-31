---
status: pending
priority: p1
issue_id: "009"
tags: [security, code-review, import-feature]
dependencies: []
---

# Arbitrary File Read via Server Action Path Injection

## Problem Statement

The server actions accept a `filePath` parameter directly from the client without validation. An attacker can read arbitrary files on the server by passing paths like `/etc/passwd` or application config files.

## Findings

**Location:** `src/actions/import.actions.ts` (lines 32-36, 167-170, 293-296)

**Evidence:**
```typescript
export async function importWhatsApp(
  filePath: string,  // ATTACKER-CONTROLLED
  chatName: string,
  userIdentifier?: string
): Promise<ImportResult> {
  // filePath is used directly without validation
```

**Attack Vector:**
1. Attacker uploads a legitimate file to get a valid `jobId`
2. Then calls `importWhatsApp("/etc/passwd", "test")` directly
3. Or `importFacebook("/app/.env")` to read secrets

**Impact:** Full file system read access within the process's permissions. Could leak database credentials, API keys, and sensitive application data.

## Proposed Solutions

### Option A: Use Job ID Lookup (Recommended)
- **Pros:** Secure, proper abstraction
- **Cons:** Requires refactoring
- **Effort:** Medium
- **Risk:** Low

```typescript
export async function importWhatsApp(jobId: string, ...): Promise<ImportResult> {
  const job = await getImportJob(jobId);
  if (!job || !job.filePath.startsWith(UPLOAD_DIR)) {
    throw new Error("Invalid job");
  }
  // Use job.filePath
```

### Option B: Validate Path Prefix
- **Pros:** Quick fix
- **Cons:** Still exposes path pattern
- **Effort:** Low
- **Risk:** Medium

```typescript
const UPLOAD_DIR = join(tmpdir(), "personal-crm-imports");
if (!filePath.startsWith(UPLOAD_DIR)) {
  throw new Error("Invalid file path");
}
```

## Recommended Action

[Leave blank - to be filled during triage]

## Technical Details

**Affected Files:**
- `src/actions/import.actions.ts`

**Components:** Import Server Actions

## Acceptance Criteria

- [ ] File paths are validated against allowed directories
- [ ] Path traversal sequences are detected and rejected
- [ ] Tests verify path validation

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-29 | Created from security review | Server actions accepting paths is a security anti-pattern |

## Resources

- PR: Current branch `feat/dashboard-redesign`
- Security Sentinel Review
