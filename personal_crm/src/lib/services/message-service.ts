import { db } from "@/lib/db";
import { Message, dbRowToMessage, MessageSource } from "@/schemas/message.schema";

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
  const result = await db.message.createMany({
    data: messages.map((m) => ({
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

  // Single query using distinct to get latest message per contact
  const messages = await db.message.findMany({
    where: { contactId: { in: contactIds } },
    orderBy: { timestamp: "desc" },
    distinct: ["contactId"],
  });

  const result: Record<string, Message> = {};
  for (const message of messages) {
    result[message.contactId] = dbRowToMessage(message);
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
