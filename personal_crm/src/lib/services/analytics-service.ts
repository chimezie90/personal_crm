import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";

export interface DailyCount {
  date: string;
  count: number;
}

export interface TopContact {
  id: string;
  displayName: string;
  photoUrl: string | null;
  messageCount: number;
  lastInteraction: Date | null;
  relationshipScore: number;
}

export interface EngagementStats {
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
    count: Number(r.count),
  }));
}

/**
 * Get top contacts by message count
 */
export async function getTopContacts(limit: number = 10): Promise<TopContact[]> {
  const rows = await db.$queryRaw<
    Array<{
      id: string;
      displayName: string;
      photoUrl: string | null;
      messageCount: bigint;
      lastInteraction: Date | null;
      relationshipScore: number;
    }>
  >`
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
export async function getEngagementStats(
  contactId: string
): Promise<EngagementStats> {
  const [totals, wordStats] = await Promise.all([
    db.message.groupBy({
      by: ["direction"],
      where: { contactId },
      _count: { _all: true },
    }),
    db.message.aggregate({
      where: { contactId, wordCount: { not: null } },
      _avg: { wordCount: true },
    }),
  ]);

  const sent = totals.find(t => t.direction === "outbound")?._count._all ?? 0;
  const received = totals.find(t => t.direction === "inbound")?._count._all ?? 0;

  return {
    totalMessages: sent + received,
    messagesSent: sent,
    messagesReceived: received,
    avgWordsPerMessage: Math.round(wordStats._avg.wordCount ?? 0),
  };
}

/**
 * Get weekly message summary (for dashboard stats)
 */
export async function getWeeklyMessageCount(): Promise<number> {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const dateStr = oneWeekAgo.toISOString().slice(0, 10);

  const result = await db.message.count({
    where: {
      timestampDate: { gte: dateStr },
    },
  });

  return result;
}

/**
 * Get contacts needing attention (no interaction in 30+ days, non-archived)
 */
export async function getContactsNeedingAttention(): Promise<number> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const result = await db.contact.count({
    where: {
      archived: false,
      lastInteraction: { lt: thirtyDaysAgo },
    },
  });

  return result;
}
