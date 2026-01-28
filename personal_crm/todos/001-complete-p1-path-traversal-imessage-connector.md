---
status: pending
priority: p1
issue_id: "001"
tags: [code-review, security, imessage, connector]
dependencies: []
---

# Path Traversal Vulnerability in iMessage Connector

## Problem Statement

The `IMessageConnector` accepts a `dbPath` from configuration without validation. An attacker who can control the connector configuration could specify arbitrary file paths, potentially reading any SQLite database on the system.

## Findings

**Location:** `src/lib/connectors/imessage/connector.ts:52-55`

```typescript
constructor(config: ConnectorConfig, events?: ConnectorEvents) {
  super(config, events);
  this.dbPath =
    (config.config.dbPath as string) || DEFAULT_IMESSAGE_DB_PATH;
}
```

**Risk:** HIGH - Could read arbitrary SQLite databases on the system, information disclosure from other applications.

## Proposed Solutions

### Option A: Path Allowlist (Recommended)
**Pros:** Simple, secure, explicit
**Cons:** Less flexible
**Effort:** Small
**Risk:** Low

```typescript
import { homedir } from "os";
import { join, resolve } from "path";

const ALLOWED_PATHS = [
  join(homedir(), "Library", "Messages", "chat.db"),
];

constructor(config: ConnectorConfig, events?: ConnectorEvents) {
  super(config, events);
  const requestedPath = (config.config.dbPath as string) || DEFAULT_IMESSAGE_DB_PATH;
  const resolvedPath = resolve(requestedPath);

  if (!ALLOWED_PATHS.includes(resolvedPath)) {
    throw new Error(`Invalid database path: ${requestedPath}`);
  }
  this.dbPath = resolvedPath;
}
```

### Option B: Directory Containment
**Pros:** More flexible for testing
**Cons:** Slightly more complex
**Effort:** Small
**Risk:** Low

```typescript
const expectedBase = join(homedir(), "Library", "Messages");
const resolvedPath = resolve(dbPath);

if (!resolvedPath.startsWith(expectedBase)) {
  throw new Error("Invalid database path");
}
```

## Recommended Action

Option A - Path allowlist is simplest and most secure for production use.

## Technical Details

**Affected files:**
- `src/lib/connectors/imessage/connector.ts`

## Acceptance Criteria

- [ ] Path validation prevents accessing files outside allowed locations
- [ ] Invalid paths throw descriptive error
- [ ] Default path still works without configuration
- [ ] Tests verify path traversal attempts are blocked

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-28 | Created from code review | Security finding from security-sentinel agent |

## Resources

- PR: Current implementation
- OWASP Path Traversal: https://owasp.org/www-community/attacks/Path_Traversal
