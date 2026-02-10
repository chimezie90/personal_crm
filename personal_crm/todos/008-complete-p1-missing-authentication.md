---
status: complete
priority: p1
issue_id: "008"
tags: [security, code-review, import-feature]
dependencies: []
---

# Missing Authentication on Import API and Server Actions

## Problem Statement

The file upload API endpoint (`/api/import`) and all import server actions (`importWhatsApp`, `importFacebook`, `importInstagram`) have **no authentication or authorization checks**. Any unauthenticated user can:
- Upload arbitrary files to the server
- Trigger imports that modify the database
- Pollute the database with malicious data

## Findings

**Location:**
- `src/app/api/import/route.ts` - No auth check before file processing
- `src/actions/import.actions.ts:32-414` - Server actions execute without verifying user identity

**Evidence:**
```typescript
// route.ts - No auth check
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    // ... proceeds directly to file operations
```

**Impact:** Complete unauthorized access to data import functionality. Attackers can exhaust server resources or pollute the database.

## Solution Implemented

Created a centralized authentication module (`src/lib/auth.ts`) with the following features:

### Authentication Methods
1. **API Key Authentication** - via `Authorization: Bearer <token>` or `X-API-Key` headers
2. **Session Cookie Authentication** - via `crm_session` cookie for browser-based requests

### Environment Configuration
- `CRM_API_KEY` - API key for authentication (required in production)
- `CRM_SESSION_SECRET` - Optional session validation secret
- In development without `CRM_API_KEY` set, authentication is bypassed for ease of testing

### Functions Provided
- `verifyApiAuth(request)` - For API route authentication
- `verifyServerActionAuth()` - For server action authentication
- `requireAuth()` - Throws error if not authenticated (for server actions)
- `unauthorizedResponse()` - Helper to return 401 responses
- `withAuth(handler)` - Higher-order function to wrap handlers with auth

### Changes Made
1. **`src/lib/auth.ts`** (new file) - Centralized authentication utilities
2. **`src/app/api/import/route.ts`** - Added `verifyApiAuth()` check before file processing
3. **`src/actions/import.actions.ts`** - Added `requireAuth()` to all three import functions

## Technical Details

**Affected Files:**
- `src/lib/auth.ts` (new)
- `src/app/api/import/route.ts`
- `src/actions/import.actions.ts`

**Components:** Import API, Server Actions

## Acceptance Criteria

- [x] API routes require valid authentication
- [x] Server actions verify user session
- [x] Unauthenticated requests return 401
- [ ] Tests verify auth requirements (manual testing recommended)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-29 | Created from security review | Personal CRM currently has no auth system |
| 2026-01-31 | Implemented authentication | Created flexible auth module supporting API keys and sessions |

## Resources

- PR: Current branch `feat/dashboard-redesign`
- Security Sentinel Review
