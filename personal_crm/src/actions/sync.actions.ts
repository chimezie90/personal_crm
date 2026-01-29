"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { createConnector, ConnectorConfig } from "@/lib/connectors";
import {
  findOrCreateContact,
  normalizeIdentifier,
  buildIdentityIndex,
} from "@/lib/services/deduplication-service";
import { createMessages } from "@/lib/services/message-service";
import { updateLastInteraction } from "@/lib/services/contact-service";
import {
  readMacContacts,
  lookupContactName,
} from "@/lib/connectors/contacts/reader";
import { parseIdentities } from "@/schemas/contact.schema";

// Import the iMessage connector to register it
import "@/lib/connectors/imessage/connector";

/**
 * Trigger a sync for a specific data source
 */
export async function syncDataSource(sourceType: string): Promise<{
  success: boolean;
  contactsImported: number;
  messagesImported: number;
  error?: string;
}> {
  const config: ConnectorConfig = {
    id: `${sourceType}-default`,
    name: sourceType,
    type: sourceType as any,
    enabled: true,
    pollIntervalMs: 60000,
    config: {},
  };

  const result = createConnector(config);

  if (!result.ok) {
    return {
      success: false,
      contactsImported: 0,
      messagesImported: 0,
      error: result.error.message,
    };
  }

  const connector = result.value;

  // Initialize the connector
  const initResult = await connector.init();
  if (!initResult.ok) {
    return {
      success: false,
      contactsImported: 0,
      messagesImported: 0,
      error: initResult.error.message,
    };
  }

  try {
    const syncStartedAt = new Date();

    // Get or create sync state
    let syncState = await db.syncState.findUnique({
      where: { source: sourceType },
    });

    if (!syncState) {
      syncState = await db.syncState.create({
        data: { source: sourceType },
      });
    }

    // Fetch and process contacts first
    let contactsImported = 0;
    const contactIdMap = new Map<string, string>(); // identifier -> contact ID

    for await (const rawContact of connector.fetchContacts()) {
      const contactId = await findOrCreateContact(rawContact, sourceType as any);
      const { normalized } = normalizeIdentifier(rawContact.identifier);
      contactIdMap.set(normalized, contactId);
      contactsImported++;
    }

    // Build identity index from existing contacts for faster lookup
    const identityIndex = await buildIdentityIndex();

    // Fetch and process messages
    let messagesImported = 0;
    let skippedMessages = 0;
    let maxMessageDate: Date | null = null;
    const messageBatch: Array<{
      contactId: string;
      source: any;
      type: "message" | "call" | "email";
      sourceMessageId: string | null;
      content: string | null;
      direction: "inbound" | "outbound";
      timestamp: Date;
      metadata: Record<string, unknown>;
    }> = [];

    const sinceDate = syncState.lastCursor
      ? new Date(syncState.lastCursor)
      : undefined;

    for await (const rawMessage of connector.fetchMessages(sinceDate)) {
      if (!rawMessage.senderIdentifier || !rawMessage.timestamp) {
        skippedMessages++;
        continue;
      }

      // Find contact ID for this message
      const { normalized } = normalizeIdentifier(rawMessage.senderIdentifier);
      let contactId = contactIdMap.get(normalized) || identityIndex.get(normalized);

      // If no contact found, create one
      if (!contactId) {
        const chatDisplayName =
          (rawMessage.metadata?.chatDisplayName as string | undefined) ||
          (rawMessage.metadata?.chatIdentifier as string | undefined) ||
          (rawMessage.metadata?.chatGuid as string | undefined);

        const displayName = rawMessage.senderIdentifier.startsWith("group:")
          ? `Group: ${chatDisplayName ?? normalized}`
          : undefined;

        contactId = await findOrCreateContact(
          {
            identifier: rawMessage.senderIdentifier,
            displayName,
            source: sourceType as any,
          },
          sourceType as any
        );
        contactIdMap.set(normalized, contactId);
      }

      messageBatch.push({
        contactId,
        source: sourceType as any,
        type: rawMessage.type,
        sourceMessageId: rawMessage.sourceId,
        content: rawMessage.content,
        direction: rawMessage.direction,
        timestamp: rawMessage.timestamp,
        metadata: rawMessage.metadata || {},
      });

      // Update last interaction time
      await updateLastInteraction(contactId, rawMessage.timestamp);

      if (!maxMessageDate || rawMessage.timestamp > maxMessageDate) {
        maxMessageDate = rawMessage.timestamp;
      }

      // Batch insert every 1000 messages
      if (messageBatch.length >= 1000) {
        const count = await createMessages(messageBatch);
        messagesImported += count;
        messageBatch.length = 0;
      }
    }

    // Insert remaining messages
    if (messageBatch.length > 0) {
      const count = await createMessages(messageBatch);
      messagesImported += count;
    }

    // Update sync state
    await db.syncState.update({
      where: { source: sourceType },
      data: {
        lastCursor: maxMessageDate
          ? maxMessageDate.toISOString()
          : syncState.lastCursor,
        lastSuccess: new Date(),
        recordsSynced: (syncState.recordsSynced || 0) + messagesImported,
        lastError: null,
      },
    });

    console.info("[sync]", {
      source: sourceType,
      startedAt: syncStartedAt.toISOString(),
      messagesImported,
      contactsImported,
      skippedMessages,
      maxMessageDate: maxMessageDate?.toISOString() ?? null,
    });

    // Revalidate cache
    revalidatePath("/");
    revalidatePath("/contacts");

    return {
      success: true,
      contactsImported,
      messagesImported,
    };
  } catch (error) {
    // Update sync state with error
    await db.syncState.update({
      where: { source: sourceType },
      data: {
        lastError: error instanceof Error ? error.message : String(error),
      },
    });

    return {
      success: false,
      contactsImported: 0,
      messagesImported: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await connector.shutdown();
  }
}

/**
 * Get sync status for all data sources
 */
export async function getSyncStatus(): Promise<
  Array<{
    source: string;
    lastSync: Date | null;
    recordsSynced: number;
    lastError: string | null;
  }>
> {
  const states = await db.syncState.findMany();
  return states.map((s) => ({
    source: s.source,
    lastSync: s.lastSuccess,
    recordsSynced: s.recordsSynced,
    lastError: s.lastError,
  }));
}

/**
 * Sync contact names from macOS Contacts
 */
export async function syncContactNames(): Promise<{
  success: boolean;
  updated: number;
  error?: string;
}> {
  try {
    // Read contacts from macOS Contacts database
    const macContacts = readMacContacts();

    if (macContacts.size === 0) {
      return {
        success: false,
        updated: 0,
        error: "Could not read macOS Contacts. Make sure Full Disk Access is enabled.",
      };
    }

    // Get all contacts that only have phone number/email as display name
    const contacts = await db.contact.findMany({
      where: { archived: false },
    });

    let updated = 0;

    for (const contact of contacts) {
      // Skip if already has a real name (not just phone/email)
      const currentName = contact.displayName;
      const looksLikeIdentifier =
        currentName.includes("@") ||
        /^[\d\s\-+()]+$/.test(currentName) ||
        currentName.startsWith("+");

      if (!looksLikeIdentifier) {
        continue;
      }

      // Try to find name from identities
      const identities = parseIdentities(contact.identities);
      let foundName: string | null = null;

      for (const identity of identities) {
        foundName = lookupContactName(identity.value, macContacts);
        if (foundName) break;
      }

      // Also try the display name itself (might be the phone number)
      if (!foundName) {
        foundName = lookupContactName(currentName, macContacts);
      }

      if (foundName) {
        await db.contact.update({
          where: { id: contact.id },
          data: { displayName: foundName },
        });
        updated++;
      }
    }

    revalidatePath("/");
    revalidatePath("/contacts");

    return { success: true, updated };
  } catch (error) {
    return {
      success: false,
      updated: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Calculate and update relationship scores for all contacts
 * Uses batch aggregation to avoid N+1 queries
 */
export async function updateRelationshipScores(): Promise<{
  success: boolean;
  updated: number;
}> {
  const contacts = await db.contact.findMany({
    where: { archived: false },
    select: { id: true },
  });

  if (contacts.length === 0) {
    return { success: true, updated: 0 };
  }

  const contactIds = contacts.map(c => c.id);
  const now = new Date();

  // Batch query: Get aggregated stats for all contacts
  // Chunk to avoid SQLite parameter limit (999)
  const chunkSize = 500;
  const statsMap = new Map<
    string,
    { contactId: string; latestTimestamp: Date | null; total: bigint; inbound: bigint; outbound: bigint }
  >();

  for (let i = 0; i < contactIds.length; i += chunkSize) {
    const chunk = contactIds.slice(i, i + chunkSize);
    const chunkStats = await db.$queryRaw<
      Array<{
        contactId: string;
        latestTimestamp: Date | null;
        total: bigint;
        inbound: bigint;
        outbound: bigint;
      }>
    >`
      SELECT
        contactId,
        MAX(timestamp) as latestTimestamp,
        COUNT(*) as total,
        SUM(CASE WHEN direction = 'inbound' THEN 1 ELSE 0 END) as inbound,
        SUM(CASE WHEN direction = 'outbound' THEN 1 ELSE 0 END) as outbound
      FROM Message
      WHERE contactId IN (${Prisma.join(chunk)})
      GROUP BY contactId
    `;

    for (const stat of chunkStats) {
      statsMap.set(stat.contactId, stat);
    }
  }

  // Prepare batch updates
  const updates: Array<{
    id: string;
    score: number;
    strength: "strong" | "moderate" | "weak" | "new";
    scoreBreakdown: string;
  }> = [];

  for (const contact of contacts) {
    const stat = statsMap.get(contact.id);

    if (!stat || stat.total === BigInt(0)) {
      continue;
    }

    const total = Number(stat.total);
    const inbound = Number(stat.inbound);
    const outbound = Number(stat.outbound);
    const latestTimestamp = stat.latestTimestamp;

    if (!latestTimestamp) continue;

    const daysSinceLastContact = Math.floor(
      (now.getTime() - latestTimestamp.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Balance ratio (1.0 = perfectly balanced, 0 = one-sided)
    const balanceRatio = total > 0 ? 1 - Math.abs(inbound - outbound) / total : 0;

    // Recency score (100 = today, decays over 90 days)
    const recencyScore = Math.max(0, 100 - (daysSinceLastContact * 100) / 90);

    // Frequency score (capped at 100)
    const frequencyScore = Math.min(100, total / 2);

    // Combined score (weighted average)
    const score = Math.round(
      recencyScore * 0.4 + frequencyScore * 0.3 + balanceRatio * 100 * 0.3
    );

    // Determine relationship strength
    let strength: "strong" | "moderate" | "weak" | "new" = "new";
    if (daysSinceLastContact > 30) {
      strength = "weak";
    } else if (total > 20 && balanceRatio > 0.3) {
      strength = "strong";
    } else if (total > 5) {
      strength = "moderate";
    }

    // Store score breakdown for analytics
    const scoreBreakdown = JSON.stringify({
      recency: Math.round(recencyScore),
      frequency: Math.round(frequencyScore),
      balance: Math.round(balanceRatio * 100),
    });

    updates.push({ id: contact.id, score, strength, scoreBreakdown });
  }

  // Execute batch updates in transaction
  await db.$transaction(
    updates.map(u =>
      db.contact.update({
        where: { id: u.id },
        data: {
          relationshipScore: u.score,
          relationshipStrength: u.strength,
          scoreBreakdown: u.scoreBreakdown,
        },
      })
    )
  );

  revalidatePath("/");
  revalidatePath("/contacts");

  return { success: true, updated: updates.length };
}

/**
 * Get dashboard stats
 */
export async function getDashboardStats(): Promise<{
  totalContacts: number;
  messagesThisWeek: number;
  needAttention: number;
}> {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const [totalContacts, messagesThisWeek, needAttention] = await Promise.all([
    db.contact.count({ where: { archived: false } }),
    db.message.count({ where: { timestamp: { gte: oneWeekAgo } } }),
    db.contact.count({
      where: {
        archived: false,
        relationshipStrength: "weak",
      },
    }),
  ]);

  return { totalContacts, messagesThisWeek, needAttention };
}
