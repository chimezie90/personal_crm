# Feature: Personal CRM Dashboard Redesign

Transform the Personal CRM dashboard into an inspiring, insight-driven relationship management system inspired by Palantini CRM.

## Enhancement Summary

**Deepened on:** 2026-01-28
**Research agents used:** TypeScript reviewer, Performance oracle, Architecture strategist, Simplicity reviewer, Data integrity guardian, Security sentinel, Pattern recognition specialist, Frontend design skill, Dashboard visualization researcher

### Key Improvements from Research
1. **Simplified MVP scope** - Remove ScoreSnapshot model, defer filtering, keep 3-component scoring
2. **Critical performance fixes** - Fix N+1 queries in sync, add timestampDate column for fast aggregations
3. **Security enhancements** - Add privacy mode for message content, validate JSON fields
4. **Type safety** - Fix `any` casts, add proper Zod validation for new fields
5. **Architecture** - Create dedicated analytics-service.ts, consolidate duplicate code

### New Considerations Discovered
- ScoreSnapshot model is YAGNI for MVP - trend can be calculated from message timestamps
- Current scatter plot (RelationshipInsights) should be simplified to a ranked list
- Separate "interests" field is over-engineering - use tags for both
- Filter bar is not needed for MVP with single iMessage source
- Privacy mode is critical for sensitive message content

---

## Overview

The current dashboard provides basic stats but lacks the visual impact and actionable insights that make relationship management engaging. This plan redesigns the dashboard to surface meaningful patterns in communication history, provide at-a-glance relationship health metrics, and help users proactively nurture their connections.

**Inspiration:** Palantini CRM features:
- GitHub-style heatmap showing message frequency over years
- Rich contact profiles with engagement analytics
- Multi-source activity tracking (messages, calls, emails, photos, calendar)
- Filterable analytics by source, city, domain, tags, interests

## Problem Statement

The current dashboard shows:
- 3 basic stat cards (total contacts, messages this week, needs attention)
- Horizontal relationship health bar
- Weekly message cadence (12-week bar chart)
- Volume vs recency scatter plot
- Simple attention list and activity feed

**What's missing:**
- Long-term communication patterns (years, not weeks)
- Per-contact engagement analytics (who initiates, response times, balance)
- Rich contact profiles (college, company, social links)
- Visual hierarchy that guides action

## Proposed Solution (MVP-Focused)

### Phase 1: Performance & Data Foundation

**Critical fixes before adding features:**

1. **Fix N+1 query in `updateRelationshipScores`** (sync.actions.ts:324-401)
2. **Add timestampDate column** for fast date-based aggregations
3. **Create analytics-service.ts** - extract analytics from message-service.ts

### Phase 2: Dashboard Transformation

1. **Activity Heatmap** - GitHub-style yearly contribution graph
2. **Enhanced Stats Cards** - Keep current 3 stats, add visual polish
3. **Simplified Top Contacts** - Replace scatter plot with ranked list
4. **Keep existing components** - RelationshipChart, AttentionList, ActivityFeed

### Phase 3: Contact Profile Enhancement

1. **Activity Heatmap** - Per-contact communication history (1 year, not 5)
2. **Engagement Balance Bar** - You vs them visualization
3. **Tag management UI** - Add/remove tags inline

---

## Technical Approach

### Research Insights

#### Performance Recommendations (Performance Oracle)

**Critical N+1 Query Fix:**
```typescript
// BEFORE (sync.actions.ts:335-396) - N+1 pattern
for (const contact of contacts) {
  const messages = await db.message.findMany({ where: { contactId: contact.id } });
  await db.contact.update({ ... });
}

// AFTER - Batch aggregation
const stats = await db.$queryRaw`
  SELECT
    contactId,
    MAX(timestamp) as latestTimestamp,
    COUNT(*) as total,
    SUM(CASE WHEN direction = 'inbound' THEN 1 ELSE 0 END) as inbound,
    SUM(CASE WHEN direction = 'outbound' THEN 1 ELSE 0 END) as outbound
  FROM Message
  WHERE contactId IN (${Prisma.join(contactIds)})
  GROUP BY contactId
`;

await db.$transaction(
  contacts.map(contact =>
    db.contact.update({
      where: { id: contact.id },
      data: calculateScore(stats.get(contact.id))
    })
  )
);
```

**Add timestampDate for fast aggregations:**
```prisma
model Message {
  // ... existing fields ...
  timestampDate   String?   // YYYY-MM-DD format, indexed

  @@index([timestampDate])
  @@index([contactId, timestampDate])
}
```

#### TypeScript Recommendations (Kieran TypeScript Reviewer)

**Fix unsafe `any` casts:**
```typescript
// BEFORE (sync.actions.ts:34)
type: sourceType as any,

// AFTER - Validate at runtime
import { messageSourceSchema, MessageSource } from "@/schemas/message.schema";

const sourceResult = messageSourceSchema.safeParse(sourceType);
if (!sourceResult.success) {
  return { success: false, error: `Invalid source type: ${sourceType}` };
}
const validatedSource: MessageSource = sourceResult.data;
```

**Add empty array guard (message-cadence.tsx:27-28):**
```typescript
if (data.length === 0) {
  return <EmptyState title="No message data" />;
}
```

#### Security Recommendations (Security Sentinel)

**Add privacy mode for message content:**
```tsx
// src/components/ui/privacy-text.tsx
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface PrivacyTextProps {
  children: string;
  className?: string;
}

export function PrivacyText({ children, className }: PrivacyTextProps) {
  const [revealed, setRevealed] = useState(false);

  return (
    <span
      className={cn(
        "cursor-pointer transition-all",
        !revealed && "blur-sm hover:blur-none",
        className
      )}
      onClick={() => setRevealed(!revealed)}
      title={revealed ? "Click to hide" : "Click to reveal"}
    >
      {children}
    </span>
  );
}
```

**Validate JSON fields with Zod:**
```typescript
// src/lib/utils/json-field.ts
import { z } from "zod";

export const scoreBreakdownSchema = z.object({
  recency: z.number().min(0).max(100).default(0),
  frequency: z.number().min(0).max(100).default(0),
  balance: z.number().min(0).max(100).default(0),
});

export const contactMetadataSchema = z.object({
  college: z.string().optional(),
  linkedIn: z.string().url().optional(),
  twitter: z.string().optional(),
  website: z.string().url().optional(),
}).passthrough();

export function parseJsonField<T>(
  json: string,
  schema: z.ZodSchema<T>,
  fieldName: string,
  defaultValue: T
): T {
  try {
    return schema.parse(JSON.parse(json));
  } catch (error) {
    console.error(`Invalid JSON in field '${fieldName}':`, error);
    return defaultValue;
  }
}
```

#### Simplicity Recommendations (Code Simplicity Reviewer)

**Remove from MVP:**
- ❌ ScoreSnapshot model - Calculate trend from message timestamps instead
- ❌ Separate "interests" field - Use tags for everything
- ❌ Filter bar - Only iMessage source, no need to filter
- ❌ 5-component score breakdown - Keep existing 3 components (recency, frequency, balance)
- ❌ 5-year heatmap on profile - Use 1 year like dashboard

**Simplify RelationshipInsights:**
```tsx
// BEFORE: Complex scatter plot with x/y positioning, size calculations
// AFTER: Simple ranked list

export function TopContactsList({ contacts }: { contacts: TopContact[] }) {
  return (
    <div className="space-y-2">
      {contacts.slice(0, 10).map((contact, index) => (
        <Link
          key={contact.id}
          href={`/contacts/${contact.id}`}
          className="flex items-center gap-3 p-2 hover:bg-warmGray-50"
        >
          <span className="text-2xl font-display text-warmGray-300 w-8">
            {index + 1}
          </span>
          <Avatar src={contact.photoUrl} fallback={contact.displayName} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{contact.displayName}</p>
            <p className="text-sm text-warmGray-500">
              {contact.messageCount} messages
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-warmGray-500">
              {formatRelativeTime(contact.lastInteraction)}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
```

---

### Schema Changes (Simplified)

```prisma
// prisma/schema.prisma

model Contact {
  id                   String    @id @default(cuid())
  displayName          String
  photoUrl             String?

  // NEW: Rich profile fields (manual entry)
  company              String?
  jobTitle             String?
  city                 String?
  metadata             String    @default("{}")  // JSON: { college, linkedIn, twitter, website }

  // Existing fields
  relationshipScore    Float     @default(50)
  relationshipStrength String    @default("new")
  lastInteraction      DateTime?
  identities           String    @default("[]")
  tags                 String    @default("[]")
  notes                String?
  archived             Boolean   @default(false)

  // NEW: Score breakdown (3 components, not 5)
  scoreBreakdown       String    @default("{}")  // JSON: { recency, frequency, balance }

  messages             Message[]
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt

  @@index([relationshipScore(sort: Desc)])
  @@index([relationshipStrength])
  @@index([lastInteraction(sort: Desc)])
  @@index([archived])
}

model Message {
  id              String    @id @default(cuid())
  contactId       String
  source          String
  type            String    @default("message")
  sourceMessageId String?
  content         String?
  direction       String
  durationSeconds Int?
  sentimentScore  Float?
  sentimentLabel  String?
  timestamp       DateTime
  metadata        String    @default("{}")

  // NEW: For fast date aggregations
  timestampDate   String?   // YYYY-MM-DD format
  wordCount       Int?

  contact Contact @relation(fields: [contactId], references: [id], onDelete: Cascade)

  @@unique([source, sourceMessageId])
  @@index([contactId, timestamp(sort: Desc)])
  @@index([timestamp(sort: Desc)])
  @@index([timestampDate])
  @@index([contactId, timestampDate])
}
```

**Note:** ScoreSnapshot model REMOVED per simplicity review. Trend can be calculated from message activity.

---

### New Components

#### 1. Activity Heatmap (`src/components/dashboard/activity-heatmap.tsx`)

```tsx
"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

interface HeatmapData {
  date: string;  // YYYY-MM-DD
  count: number;
}

interface ActivityHeatmapProps {
  data: HeatmapData[];
  weeks?: number;
}

export function ActivityHeatmap({ data, weeks = 52 }: ActivityHeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<{ date: string; count: number } | null>(null);

  const { grid, max, countsByDate } = useMemo(() => {
    const counts = new Map(data.map(d => [d.date, d.count]));
    const maxCount = Math.max(...data.map(d => d.count), 1);

    // Generate weeks grid starting from today going back
    const today = new Date();
    const grid: Date[][] = [];

    for (let w = weeks - 1; w >= 0; w--) {
      const week: Date[] = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(today);
        date.setDate(today.getDate() - (w * 7) - (6 - d));
        week.push(date);
      }
      grid.push(week);
    }

    return { grid, max: maxCount, countsByDate: counts };
  }, [data, weeks]);

  const getIntensity = (count: number): string => {
    if (count === 0) return "bg-warmGray-100";
    const ratio = count / max;
    if (ratio <= 0.25) return "bg-sage-200";
    if (ratio <= 0.5) return "bg-sage-300";
    if (ratio <= 0.75) return "bg-sage-400";
    return "bg-sage-500";
  };

  return (
    <div
      role="img"
      aria-label={`Activity heatmap showing ${data.reduce((sum, d) => sum + d.count, 0)} total messages`}
      className="relative"
    >
      {/* Screen reader summary */}
      <div className="sr-only">
        {data.filter(d => d.count > 0).length} active days with up to {max} messages on the busiest day.
      </div>

      <div className="flex gap-0.5 overflow-x-auto pb-2" aria-hidden="true">
        {grid.map((week, weekIndex) => (
          <div key={weekIndex} className="flex flex-col gap-0.5">
            {week.map((day) => {
              const dateKey = day.toISOString().slice(0, 10);
              const count = countsByDate.get(dateKey) ?? 0;

              return (
                <div
                  key={dateKey}
                  className={cn(
                    "w-3 h-3 border border-warmGray-300 cursor-pointer transition-transform hover:scale-125",
                    getIntensity(count)
                  )}
                  onMouseEnter={() => setHoveredCell({ date: dateKey, count })}
                  onMouseLeave={() => setHoveredCell(null)}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* Tooltip */}
      {hoveredCell && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full bg-warmGray-900 text-cream px-2 py-1 text-xs whitespace-nowrap z-10">
          {hoveredCell.date}: {hoveredCell.count} message{hoveredCell.count !== 1 ? 's' : ''}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-end gap-2 mt-3 text-xs text-warmGray-600">
        <span>Less</span>
        <div className="flex gap-0.5">
          {["bg-warmGray-100", "bg-sage-200", "bg-sage-300", "bg-sage-400", "bg-sage-500"].map((color, i) => (
            <div key={i} className={cn("w-3 h-3 border border-warmGray-300", color)} />
          ))}
        </div>
        <span>More</span>
      </div>
    </div>
  );
}
```

#### 2. Top Contacts List (`src/components/dashboard/top-contacts.tsx`)

```tsx
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { formatRelativeTime } from "@/lib/utils";

interface TopContact {
  id: string;
  displayName: string;
  photoUrl: string | null;
  messageCount: number;
  lastInteraction: Date | null;
  relationshipScore: number;
}

interface TopContactsListProps {
  contacts: TopContact[];
}

export function TopContactsList({ contacts }: TopContactsListProps) {
  if (contacts.length === 0) {
    return (
      <div className="text-center py-8 text-warmGray-500">
        <p>No contacts yet</p>
        <p className="text-sm mt-1">Sync a data source to see your top connections</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {contacts.slice(0, 10).map((contact, index) => (
        <Link
          key={contact.id}
          href={`/contacts/${contact.id}`}
          className="flex items-center gap-3 p-3 -mx-3 hover:bg-warmGray-50 transition-colors"
        >
          <span className="text-2xl font-display text-warmGray-300 w-8 text-center">
            {index + 1}
          </span>
          <Avatar
            src={contact.photoUrl}
            fallback={contact.displayName.slice(0, 2)}
            size="sm"
          />
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{contact.displayName}</p>
            <p className="text-sm text-warmGray-500">
              {contact.messageCount.toLocaleString()} messages
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm font-display">{Math.round(contact.relationshipScore)}</div>
            <p className="text-xs text-warmGray-500">
              {contact.lastInteraction ? formatRelativeTime(contact.lastInteraction) : 'Never'}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
```

#### 3. Engagement Balance Bar (`src/components/contacts/engagement-balance.tsx`)

```tsx
import { cn } from "@/lib/utils";

interface EngagementBalanceProps {
  sent: number;
  received: number;
}

export function EngagementBalance({ sent, received }: EngagementBalanceProps) {
  const total = sent + received;
  if (total === 0) {
    return (
      <div className="text-center py-4 text-warmGray-500 text-sm">
        No messages yet
      </div>
    );
  }

  const sentRatio = sent / total;
  const sentPercent = Math.round(sentRatio * 100);
  const receivedPercent = 100 - sentPercent;

  const balanceLabel = sentRatio > 0.6
    ? "You reach out more"
    : sentRatio < 0.4
    ? "They reach out more"
    : "Balanced conversation";

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-warmGray-600">Conversation Balance</span>
        <span className="text-warmGray-500">{balanceLabel}</span>
      </div>

      <div className="h-4 flex border-2 border-warmGray-900 overflow-hidden">
        <div
          className="bg-sage-400 h-full transition-all"
          style={{ width: `${sentPercent}%` }}
          title={`You sent: ${sent.toLocaleString()} messages (${sentPercent}%)`}
        />
        <div
          className="bg-terracotta h-full transition-all"
          style={{ width: `${receivedPercent}%` }}
          title={`They sent: ${received.toLocaleString()} messages (${receivedPercent}%)`}
        />
      </div>

      <div className="flex justify-between text-xs text-warmGray-500">
        <span>You ({sent.toLocaleString()})</span>
        <span>Them ({received.toLocaleString()})</span>
      </div>
    </div>
  );
}
```

---

### New Services

#### Analytics Service (`src/lib/services/analytics-service.ts`)

```typescript
import { db } from "@/lib/db";

interface DailyCount {
  date: string;
  count: number;
}

interface TopContact {
  id: string;
  displayName: string;
  photoUrl: string | null;
  messageCount: number;
  lastInteraction: Date | null;
  relationshipScore: number;
}

interface EngagementStats {
  totalMessages: number;
  messagesSent: number;
  messagesReceived: number;
  avgWordsPerMessage: number;
}

/**
 * Get daily message counts for heatmap visualization
 * Uses timestampDate column for fast aggregation
 */
export async function getDailyMessageCounts(
  startDate: Date,
  endDate: Date,
  contactId?: string
): Promise<DailyCount[]> {
  const startStr = startDate.toISOString().slice(0, 10);
  const endStr = endDate.toISOString().slice(0, 10);

  const whereClause = contactId
    ? `AND contactId = '${contactId}'`
    : '';

  const rows = await db.$queryRaw<Array<{ date: string; count: bigint }>>`
    SELECT timestampDate as date, COUNT(*) as count
    FROM Message
    WHERE timestampDate >= ${startStr}
      AND timestampDate <= ${endStr}
      ${contactId ? Prisma.sql`AND contactId = ${contactId}` : Prisma.empty}
    GROUP BY timestampDate
    ORDER BY timestampDate ASC
  `;

  return rows.map(r => ({
    date: r.date,
    count: Number(r.count)
  }));
}

/**
 * Get top contacts by message count
 */
export async function getTopContacts(limit: number = 10): Promise<TopContact[]> {
  const rows = await db.$queryRaw<Array<{
    id: string;
    displayName: string;
    photoUrl: string | null;
    messageCount: bigint;
    lastInteraction: Date | null;
    relationshipScore: number;
  }>>`
    SELECT
      c.id,
      c.displayName,
      c.photoUrl,
      c.lastInteraction,
      c.relationshipScore,
      COUNT(m.id) as messageCount
    FROM Contact c
    LEFT JOIN Message m ON c.id = m.contactId
    WHERE c.archived = false
    GROUP BY c.id
    ORDER BY messageCount DESC
    LIMIT ${limit}
  `;

  return rows.map(r => ({
    ...r,
    messageCount: Number(r.messageCount),
  }));
}

/**
 * Get engagement statistics for a contact
 */
export async function getEngagementStats(contactId: string): Promise<EngagementStats> {
  const [totals, wordStats] = await Promise.all([
    db.message.groupBy({
      by: ['direction'],
      where: { contactId },
      _count: { _all: true },
    }),
    db.message.aggregate({
      where: { contactId, wordCount: { not: null } },
      _avg: { wordCount: true },
    }),
  ]);

  const sent = totals.find(t => t.direction === 'outbound')?._count._all ?? 0;
  const received = totals.find(t => t.direction === 'inbound')?._count._all ?? 0;

  return {
    totalMessages: sent + received,
    messagesSent: sent,
    messagesReceived: received,
    avgWordsPerMessage: Math.round(wordStats._avg.wordCount ?? 0),
  };
}
```

---

## Acceptance Criteria (MVP)

### Phase 1: Performance & Data Foundation
- [x] N+1 query in `updateRelationshipScores` fixed with batch aggregation
- [x] `timestampDate` column added to Message model with index
- [x] Migration backfills timestampDate for existing messages
- [x] analytics-service.ts created with getDailyMessageCounts, getTopContacts, getEngagementStats
- [x] Analytics functions moved out of message-service.ts

### Phase 2: Dashboard
- [x] Activity heatmap displays 1 year (52 weeks) of daily message counts
- [x] Heatmap cells show tooltip with date and count on hover
- [x] Heatmap has proper accessibility (aria-label, screen reader summary)
- [x] Top contacts list replaces scatter plot (RelationshipInsights)
- [x] Top 10 contacts shown ranked by message count
- [x] Existing components preserved: RelationshipChart, AttentionList, ActivityFeed

### Phase 3: Contact Profile
- [x] Activity heatmap displays 1 year for the specific contact
- [x] Engagement balance bar shows sent vs received ratio
- [x] Profile header shows company, city if available
- [ ] Tags can be added inline (simple input)
- [ ] Privacy mode available for message content (blur by default)

---

## Success Metrics

1. **Visual Impact**: Dashboard immediately communicates relationship patterns via heatmap
2. **Actionable Insights**: Users can identify top contacts and neglected relationships at a glance
3. **Performance**: Dashboard loads in <2 seconds with 1000+ contacts (fix N+1 queries)
4. **Simplicity**: MVP ships with ~500 fewer lines than originally planned

---

## Dependencies & Risks

### Dependencies
- Prisma migration must run without data loss
- Existing iMessage connector continues working

### Risks
- **Performance**: Heatmap with 365 SVG cells is manageable; monitor for issues
  - *Mitigation*: Use CSS-based rendering, not heavy SVG library
- **Data Volume**: Batch queries mitigate issues with 100k+ messages
  - *Mitigation*: timestampDate index, batch aggregation
- **Migration**: Adding timestampDate requires backfill
  - *Mitigation*: Run backfill in batches, test on copy first

---

## Implementation Phases

### Phase 1: Foundation (~2-3 hours)
1. Create Prisma migration adding timestampDate, scoreBreakdown
2. Write backfill script for timestampDate
3. Create analytics-service.ts
4. Fix N+1 query in updateRelationshipScores
5. Add JSON validation utilities

### Phase 2: Dashboard (~3-4 hours)
1. Create ActivityHeatmap component
2. Create TopContactsList component
3. Replace RelationshipInsights with TopContactsList
4. Update dashboard page layout
5. Add Suspense boundaries for streaming

### Phase 3: Contact Profile (~2-3 hours)
1. Add ActivityHeatmap to contact page (1 year)
2. Create EngagementBalance component
3. Add inline tag editing
4. Add privacy mode for message content
5. Display company/city in header

---

## File Changes Summary

### New Files
- `src/lib/services/analytics-service.ts` - Analytics queries
- `src/components/dashboard/activity-heatmap.tsx` - Heatmap visualization
- `src/components/dashboard/top-contacts.tsx` - Ranked contact list
- `src/components/contacts/engagement-balance.tsx` - Balance bar
- `src/components/ui/privacy-text.tsx` - Blurred text component
- `src/lib/utils/json-field.ts` - JSON validation utilities
- `prisma/migrations/XXX_add_analytics_fields/migration.sql` - Schema migration

### Modified Files
- `prisma/schema.prisma` - Add timestampDate, scoreBreakdown fields
- `src/app/page.tsx` - Add heatmap, replace scatter plot with top contacts
- `src/app/contacts/[id]/page.tsx` - Add heatmap, engagement balance
- `src/actions/sync.actions.ts` - Fix N+1, calculate timestampDate and wordCount
- `src/lib/services/message-service.ts` - Remove analytics functions (moved to analytics-service)

### Removed/Simplified
- `src/components/dashboard/relationship-insights.tsx` - Replace with TopContactsList
- ScoreSnapshot model - Not needed for MVP

---

## References

### Internal
- Current dashboard: `src/app/page.tsx`
- Current contact profile: `src/app/contacts/[id]/page.tsx`
- Message service: `src/lib/services/message-service.ts`
- Sync actions: `src/actions/sync.actions.ts`
- Schema: `prisma/schema.prisma`

### External
- [Next.js Streaming Guide](https://nextjs.org/learn/dashboard-app/streaming)
- [Recharts Documentation](https://recharts.org/)
- [Microsoft Dynamics 365 Relationship Analytics](https://learn.microsoft.com/en-us/dynamics365/sales/relationship-analytics)
- [nuqs - Type-safe URL search params](https://nuqs.dev/)

### Research Applied
- TypeScript type safety improvements from Kieran TypeScript Reviewer
- N+1 query fix pattern from Performance Oracle
- Service boundary separation from Architecture Strategist
- MVP scope reduction from Code Simplicity Reviewer
- JSON validation and migration safety from Data Integrity Guardian
- Privacy mode for messages from Security Sentinel
- Heatmap accessibility from Dashboard Visualization Research
- Warm Brutalism design patterns from Frontend Design Skill
