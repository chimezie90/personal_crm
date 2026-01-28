"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { createConnector, ConnectorConfig } from "@/lib/connectors";
import {
  findOrCreateContact,
  normalizeIdentifier,
  buildIdentityIndex,
} from "@/lib/services/deduplication-service";
import { createMessages } from "@/lib/services/message-service";
import { updateLastInteraction } from "@/lib/services/contact-service";

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
      // Find contact ID for this message
      const { normalized } = normalizeIdentifier(rawMessage.senderIdentifier);
      let contactId = contactIdMap.get(normalized) || identityIndex.get(normalized);

      // If no contact found, create one
      if (!contactId) {
        contactId = await findOrCreateContact(
          { identifier: rawMessage.senderIdentifier, source: sourceType as any },
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
        lastCursor: new Date().toISOString(),
        lastSuccess: new Date(),
        recordsSynced: (syncState.recordsSynced || 0) + messagesImported,
        lastError: null,
      },
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
