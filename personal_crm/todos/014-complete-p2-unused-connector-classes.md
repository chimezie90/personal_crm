---
status: complete
priority: p2
issue_id: "014"
tags: [architecture, code-review, import-feature]
dependencies: []
---

# Unused Connector Classes Should Be Removed

## Problem Statement

The WhatsApp, Facebook, and Instagram connector classes (~511 lines total) are imported in `import.actions.ts` but **never actually used**. The server actions directly call the parser functions, completely bypassing the connector classes. This is dead code adding complexity.

## Findings

**Location:**
- `src/lib/connectors/whatsapp/connector.ts` (179 lines)
- `src/lib/connectors/facebook/connector.ts` (164 lines)
- `src/lib/connectors/instagram/connector.ts` (168 lines)
- `src/lib/connectors/base-connector.ts` (99 lines) - KEPT: used by iMessage connector
- `src/lib/connectors/registry.ts` (72 lines) - KEPT: used by sync.actions.ts for iMessage

**Evidence from import.actions.ts:**
```typescript
// Import connectors to register them
import "@/lib/connectors/whatsapp/connector";
import "@/lib/connectors/facebook/connector";
import "@/lib/connectors/instagram/connector";

// But then directly imports parsers instead:
const { parseWhatsAppExport, extractWhatsAppContacts } = await import(
  "@/lib/connectors/whatsapp/parser"
);
```

**YAGNI Violation:** The connector pattern with state management, events, lifecycle methods (`init`, `shutdown`, `healthCheck`) adds complexity but provides no value for file-based imports.

## Proposed Solutions

### Option A: Delete Unused Code (Recommended)
- **Pros:** Cleaner codebase, reduced maintenance
- **Cons:** Loss of potential future functionality
- **Effort:** Low
- **Risk:** Low

Delete:
- `src/lib/connectors/whatsapp/connector.ts`
- `src/lib/connectors/facebook/connector.ts`
- `src/lib/connectors/instagram/connector.ts`
- Unused imports in `import.actions.ts`

### Option B: Use the Connectors
- **Pros:** More consistent architecture
- **Cons:** More work, connectors may not fit file-import use case
- **Effort:** High
- **Risk:** Medium

## Recommended Action

Option A was implemented.

## Technical Details

**Files Deleted:**
- `src/lib/connectors/whatsapp/connector.ts`
- `src/lib/connectors/facebook/connector.ts`
- `src/lib/connectors/instagram/connector.ts`

**Files Modified:**
- `src/actions/import.actions.ts` - Removed connector imports

**Files Kept:**
- `src/lib/connectors/base-connector.ts` - Used by iMessage connector
- `src/lib/connectors/registry.ts` - Used by sync.actions.ts via createConnector()

## Acceptance Criteria

- [x] No unused code in connectors directory
- [x] Parsers are used directly without connector abstraction
- [x] All imports pass type checking

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-29 | Created from simplicity review | Connector pattern doesn't fit file-import use case |
| 2026-01-31 | Resolved: Deleted 3 unused connector files (~511 lines) and removed imports from import.actions.ts | base-connector.ts and registry.ts are still needed for iMessage connector |

## Resources

- PR: Current branch `feat/dashboard-redesign`
- Code Simplicity Reviewer
- Architecture Strategist Review
