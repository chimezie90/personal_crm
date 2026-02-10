import { db } from "@/lib/db";
import { Message, dbRowToMessage, MessageSource } from "@/schemas/message.schema";

const IN_QUERY_CHUNK_SIZE = 500;

function chunkArray<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Get messages for a contact
 */
export async function getContactMessages(
  contactId: string,
  options?: {
    limit?: number;
    offset?: number;
    since?: Date;
  }
): Promise<Message[]> {
  const { limit = 50, offset = 0, since } = options || {};

  const messages = await db.message.findMany({
    where: {
      contactId,
      ...(since && { timestamp: { gte: since } }),
    },
    orderBy: { timestamp: "desc" },
    take: limit,
    skip: offset,
  });

  return messages.map(dbRowToMessage);
}

/**
 * Get a single message by ID
 */
export async function getMessage(id: string): Promise<Message | null> {
  const message = await db.message.findUnique({
    where: { id },
  });

  if (!message) return null;
  return dbRowToMessage(message);
}

/**
 * Create a new message
 */
export async function createMessage(input: {
  contactId: string;
  source: MessageSource;
  type: "message" | "call" | "email";
  sourceMessageId?: string | null;
  content?: string | null;
  direction: "inbound" | "outbound";
  durationSeconds?: number | null;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}): Promise<Message> {
  const message = await db.message.create({
    data: {
      contactId: input.contactId,
      source: input.source,
      type: input.type,
      sourceMessageId: input.sourceMessageId ?? null,
      content: input.content ?? null,
      direction: input.direction,
      durationSeconds: input.durationSeconds ?? null,
      timestamp: input.timestamp,
      metadata: JSON.stringify(input.metadata || {}),
    },
  });

  return dbRowToMessage(message);
}

/**
 * Bulk create messages
 */
export async function createMessages(
  messages: Array<{
    contactId: string;
    source: MessageSource;
    type: "message" | "call" | "email";
    sourceMessageId?: string | null;
    content?: string | null;
    direction: "inbound" | "outbound";
    durationSeconds?: number | null;
    timestamp: Date;
    metadata?: Record<string, unknown>;
  }>
): Promise<number> {
  // Deduplicate within batch by source + sourceMessageId
  const seen = new Set<string>();
  const uniqueMessages = messages.filter((m) => {
    if (!m.sourceMessageId) return true; // Allow messages without sourceMessageId
    const key = `${m.source}:${m.sourceMessageId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (uniqueMessages.length === 0) return 0;

  // Filter out messages that already exist in the database
  const messagesWithSourceId = uniqueMessages.filter((m) => m.sourceMessageId);
  const existingKeys = new Set<string>();

  if (messagesWithSourceId.length > 0) {
    const idsBySource = new Map<MessageSource, Set<string>>();
    for (const message of messagesWithSourceId) {
      const set = idsBySource.get(message.source) ?? new Set<string>();
      set.add(message.sourceMessageId as string);
      idsBySource.set(message.source, set);
    }

    for (const [source, idsSet] of idsBySource.entries()) {
      const ids = Array.from(idsSet);
      for (const chunk of chunkArray(ids, IN_QUERY_CHUNK_SIZE)) {
        const existing = await db.message.findMany({
          where: {
            source,
            sourceMessageId: { in: chunk },
          },
          select: { sourceMessageId: true },
        });

        for (const row of existing) {
          if (row.sourceMessageId) {
            existingKeys.add(`${source}:${row.sourceMessageId}`);
          }
        }
      }
    }
  }

  const filteredMessages = uniqueMessages.filter((m) => {
    if (!m.sourceMessageId) return true;
    return !existingKeys.has(`${m.source}:${m.sourceMessageId}`);
  });

  if (filteredMessages.length === 0) return 0;

  const result = await db.message.createMany({
    data: filteredMessages.map((m) => ({
      contactId: m.contactId,
      source: m.source,
      type: m.type,
      sourceMessageId: m.sourceMessageId ?? null,
      content: m.content ?? null,
      direction: m.direction,
      durationSeconds: m.durationSeconds ?? null,
      timestamp: m.timestamp,
      metadata: JSON.stringify(m.metadata || {}),
    })),
  });

  return result.count;
}

/**
 * Get message counts by contact
 */
export async function getMessageCountsByContact(
  contactIds: string[],
  since?: Date
): Promise<Record<string, number>> {
  if (contactIds.length === 0) return {};

  const counts: Record<string, number> = {};

  // Chunk contactIds to avoid SQLite query parameter limit
  for (const chunk of chunkArray(contactIds, IN_QUERY_CHUNK_SIZE)) {
    const rows = await db.message.groupBy({
      by: ["contactId"],
      _count: { _all: true },
      where: {
        contactId: { in: chunk },
        ...(since && { timestamp: { gte: since } }),
      },
    });

    for (const row of rows) {
      counts[row.contactId] = row._count._all;
    }
  }

  return counts;
}

/**
 * Get messages per week for the last N weeks
 */
export async function getMessageCadence(
  weeks: number = 12
): Promise<Array<{ start: Date; count: number }>> {
  const now = new Date();
  const start = new Date();
  start.setDate(now.getDate() - weeks * 7);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay();
  const diff = (day + 6) % 7;
  start.setDate(start.getDate() - diff);

  const rows = await db.$queryRaw<
    Array<{ week_start: string; count: number }>
  >`SELECT strftime('%Y-%m-%d', timestamp, 'weekday 1', '-7 days') as week_start,
      COUNT(*) as count
    FROM Message
    WHERE timestamp >= ${start.toISOString()}
    GROUP BY week_start
    ORDER BY week_start ASC`;

  const countsByWeek = new Map<string, number>();
  for (const row of rows) {
    countsByWeek.set(row.week_start, row.count);
  }

  const results: Array<{ start: Date; count: number }> = [];
  const cursor = new Date(start);
  for (let i = 0; i < weeks; i++) {
    const key = cursor.toISOString().slice(0, 10);
    results.push({ start: new Date(cursor), count: countsByWeek.get(key) ?? 0 });
    cursor.setDate(cursor.getDate() + 7);
  }

  return results;
}

/**
 * Get message count for a contact
 */
export async function getContactMessageCount(contactId: string): Promise<number> {
  return db.message.count({
    where: { contactId },
  });
}

/**
 * Get total message count
 */
export async function getTotalMessageCount(): Promise<number> {
  return db.message.count();
}

/**
 * Get latest message for each contact
 */
export async function getLatestMessagesPerContact(
  contactIds: string[]
): Promise<Record<string, Message>> {
  if (contactIds.length === 0) return {};

  const result: Record<string, Message> = {};

  // Chunk contactIds to avoid SQLite query parameter limit
  for (const chunk of chunkArray(contactIds, IN_QUERY_CHUNK_SIZE)) {
    const messages = await db.message.findMany({
      where: { contactId: { in: chunk } },
      orderBy: { timestamp: "desc" },
      distinct: ["contactId"],
    });

    for (const message of messages) {
      result[message.contactId] = dbRowToMessage(message);
    }
  }

  return result;
}

/**
 * Get message stats for a contact
 */
export async function getContactMessageStats(contactId: string): Promise<{
  total: number;
  inbound: number;
  outbound: number;
  bySources: Record<string, number>;
}> {
  const messages = await db.message.findMany({
    where: { contactId },
    select: { direction: true, source: true },
  });

  const stats = {
    total: messages.length,
    inbound: 0,
    outbound: 0,
    bySources: {} as Record<string, number>,
  };

  for (const msg of messages) {
    if (msg.direction === "inbound") {
      stats.inbound++;
    } else {
      stats.outbound++;
    }

    stats.bySources[msg.source] = (stats.bySources[msg.source] || 0) + 1;
  }

  return stats;
}

/**
 * Get recent messages across all contacts
 */
export async function getRecentMessages(limit: number = 20): Promise<Message[]> {
  const messages = await db.message.findMany({
    orderBy: { timestamp: "desc" },
    take: limit,
  });

  return messages.map(dbRowToMessage);
}

/**
 * Check if a message with source ID already exists
 */
export async function messageExists(
  source: MessageSource,
  sourceMessageId: string
): Promise<boolean> {
  const count = await db.message.count({
    where: { source, sourceMessageId },
  });

  return count > 0;
}
