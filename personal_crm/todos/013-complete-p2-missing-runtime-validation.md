---
status: complete
priority: p2
issue_id: "013"
tags: [type-safety, code-review, import-feature]
dependencies: []
---

# Missing Runtime Validation for External JSON

## Problem Statement

The Facebook and Instagram parsers use `JSON.parse` with type assertions but no runtime validation. External data (user-uploaded exports) should never be trusted. Malformed or malicious JSON could cause runtime crashes.

## Findings

**Location:**
- `src/lib/connectors/facebook/parser.ts:84`
- `src/lib/connectors/instagram/parser.ts:86`

**Evidence:**
```typescript
const data = JSON.parse(content) as FBConversation;  // No validation!
```

**Impact:** If the JSON file is malformed, corrupted, or does not match the expected schema, properties will be accessed on undefined values, causing runtime crashes.

## Solution Implemented

### Zod Schema Validation

Added comprehensive Zod schemas for both Facebook and Instagram parsers:

**Facebook Parser (`src/lib/connectors/facebook/parser.ts`):**
- `fbReactionSchema` - Validates reaction objects
- `fbMediaSchema` - Validates photo/video media objects
- `fbStickerSchema` - Validates sticker objects
- `fbShareSchema` - Validates share objects
- `fbMessageSchema` - Validates individual messages
- `fbParticipantSchema` - Validates participant objects
- `fbConversationMetaSchema` - Validates conversation metadata
- `fbConversationSchema` - Validates complete conversations

**Instagram Parser (`src/lib/connectors/instagram/parser.ts`):**
- `igMediaSchema` - Validates photo/video media objects
- `igShareSchema` - Validates share objects
- `igReactionSchema` - Validates reaction objects
- `igMessageSchema` - Validates individual messages
- `igParticipantSchema` - Validates participant objects
- `igConversationMetaSchema` - Validates conversation metadata
- `igConversationSchema` - Validates complete conversations

**Key Features:**
1. Custom error classes (`FacebookParseError`, `InstagramParseError`) with file path and details
2. Streaming validation - each message validated as it's read from the stream
3. Configurable behavior via `skipInvalid` option (default: true to skip invalid messages)
4. Metadata validation for title, participants, and thread_type fields
5. Helpful error messages showing field path and validation issue

## Technical Details

**Affected Files:**
- `src/lib/connectors/facebook/parser.ts`
- `src/lib/connectors/instagram/parser.ts`

## Acceptance Criteria

- [x] All external JSON is validated before use
- [x] Invalid JSON returns helpful error message
- [x] Partial/malformed exports don't crash the server

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-29 | Created from TypeScript review | Zod already used in schemas/ |
| 2026-01-31 | Implemented Zod validation | Streaming validation with safeParse works well with stream-json |

## Resources

- PR: Current branch `feat/dashboard-redesign`
- Kieran TypeScript Reviewer
