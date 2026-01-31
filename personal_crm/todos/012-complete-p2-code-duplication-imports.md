---
status: complete
priority: p2
issue_id: "012"
tags: [architecture, code-review, import-feature]
dependencies: []
---

# Massive Code Duplication in Import Actions

## Problem Statement

The three import functions (`importWhatsApp`, `importFacebook`, `importInstagram`) are 95%+ identical, totaling ~400 lines of duplicated code. This violates DRY principles and creates maintenance burden.

## Findings

**Location:** `src/actions/import.actions.ts` (lines 32-162, 167-288, 293-414)

**Duplicated Logic:**
- Building identity index (3x)
- Contact extraction loop (3x)
- Message batch processing (3x)
- Last interaction tracking (3x)
- Transaction updates (3x)
- Cache revalidation (3x)

**Also Duplicated:**
- `src/lib/connectors/facebook/parser.ts` and `instagram/parser.ts` are ~90% identical
- `src/lib/connectors/facebook/connector.ts` and `instagram/connector.ts` are ~95% identical

**Estimated Redundant Code:** ~800 lines

## Solution Implemented

### Option A: Generic Import Function (Implemented)

Created a generic `executeImport<TOptions>` function that handles the common import workflow:

```typescript
interface ImportConfig<TOptions = unknown> {
  source: DataSourceType;
  extractContacts: (path: string, options: TOptions) => AsyncGenerator<RawContact>;
  parseMessages: (path: string, options: TOptions) => AsyncGenerator<RawMessage>;
  getDisplayNameFromMessage?: (msg: RawMessage) => string | undefined;
  cleanupFile?: boolean;
  logPrefix: string;
}

async function executeImport<TOptions>(
  config: ImportConfig<TOptions>,
  filePath: string,
  options: TOptions
): Promise<ImportResult> {
  // 1. Authentication check
  // 2. File path validation
  // 3. Identity index building
  // 4. Contact extraction and creation
  // 5. Message streaming and batch processing
  // 6. Last interaction tracking
  // 7. Cache revalidation
}
```

Each import function is now a thin wrapper providing source-specific configuration:

```typescript
export async function importWhatsApp(filePath, chatName, userIdentifier?) {
  return executeImport({
    source: "whatsapp",
    extractContacts: (path, opts) => extractWhatsAppContacts(path, opts.chatName, ...),
    parseMessages: (path, opts) => parseWhatsAppExport(path, opts.chatName, ...),
    getDisplayNameFromMessage: (msg) => msg.metadata?.originalAuthor,
    cleanupFile: true,
    logPrefix: "import-whatsapp",
  }, filePath, { chatName, userIdentifier });
}
```

## Technical Details

**Modified Files:**
- `src/actions/import.actions.ts` - Refactored with generic executeImport function

**Code Reduction:**
- Before: ~475 lines (3 nearly identical 140-line functions)
- After: ~340 lines (1 generic function + 3 thin wrappers)
- Net reduction: ~135 lines (~28% reduction)
- Duplicated logic: 1x instead of 3x

## Acceptance Criteria

- [x] Import logic is in one place (executeImport handles all common logic)
- [x] Adding a new source requires minimal code (~15 lines of config)
- [x] All existing functionality preserved (same public API)
- [x] TypeScript compilation passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-29 | Created from simplicity/architecture reviews | Meta (FB/IG) share identical export formats |
| 2026-01-31 | Implemented generic executeImport function | Generic type parameters enable type-safe config objects |

## Resources

- PR: Current branch `feat/dashboard-redesign`
- Code Simplicity Reviewer
- Architecture Strategist Review
