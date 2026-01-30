"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { DataSourceType } from "@/lib/connectors/types";
import {
  findOrCreateContact,
  normalizeIdentifier,
  buildIdentityIndex,
} from "@/lib/services/deduplication-service";
import { createMessages } from "@/lib/services/message-service";
import { unlink } from "fs/promises";
import { tmpdir } from "os";
import { join, resolve } from "path";

/**
 * Secure upload directory - must match the one in /api/import/route.ts
 */
const UPLOAD_DIR = join(tmpdir(), "personal-crm-imports");

/**
 * Validate that a file path is within the expected upload directory.
 * Prevents path traversal attacks that could read arbitrary files.
 */
function validateFilePath(filePath: string): void {
  const resolvedPath = resolve(filePath);
  if (!resolvedPath.startsWith(UPLOAD_DIR)) {
    throw new Error("Invalid file path: must be within upload directory");
  }
}

// Import connectors to register them
import "@/lib/connectors/whatsapp/connector";
import "@/lib/connectors/facebook/connector";
import "@/lib/connectors/instagram/connector";

/**
 * Import result type
 */
export interface ImportResult {
  success: boolean;
  messagesImported: number;
  contactsCreated: number;
  error?: string;
}

/**
 * Process a WhatsApp export file
 */
export async function importWhatsApp(
  filePath: string,
  chatName: string,
  userIdentifier?: string
): Promise<ImportResult> {
  // Validate file path to prevent arbitrary file access
  validateFilePath(filePath);

  const { parseWhatsAppExport, extractWhatsAppContacts } = await import(
    "@/lib/connectors/whatsapp/parser"
  );

  try {
    const source: DataSourceType = "whatsapp";

    // Build identity index for faster lookups
    const identityIndex = await buildIdentityIndex();
    const contactIdMap = new Map<string, string>();

    // First, extract and create contacts
    let contactsCreated = 0;
    for await (const rawContact of extractWhatsAppContacts(filePath, chatName, {
      userIdentifier,
    })) {
      const contactId = await findOrCreateContact(rawContact, source);
      const { normalized } = normalizeIdentifier(rawContact.identifier);
      contactIdMap.set(normalized, contactId);
      identityIndex.set(normalized, contactId);
      contactsCreated++;
    }

    // Then, import messages in batches
    let messagesImported = 0;
    const messageBatch: Array<{
      contactId: string;
      source: DataSourceType;
      type: "message" | "call" | "email";
      sourceMessageId: string | null;
      content: string | null;
      direction: "inbound" | "outbound";
      timestamp: Date;
      metadata: Record<string, unknown>;
    }> = [];

    const lastInteractionMap = new Map<string, Date>();

    for await (const rawMessage of parseWhatsAppExport(filePath, chatName, {
      userIdentifier,
    })) {
      const { normalized } = normalizeIdentifier(rawMessage.senderIdentifier);
      let contactId = contactIdMap.get(normalized) || identityIndex.get(normalized);

      if (!contactId) {
        // Create contact on the fly
        contactId = await findOrCreateContact(
          {
            identifier: rawMessage.senderIdentifier,
            displayName: rawMessage.metadata?.originalAuthor as string | undefined,
            source,
          },
          source
        );
        contactIdMap.set(normalized, contactId);
        identityIndex.set(normalized, contactId);
      }

      messageBatch.push({
        contactId,
        source,
        type: rawMessage.type,
        sourceMessageId: rawMessage.sourceId,
        content: rawMessage.content,
        direction: rawMessage.direction,
        timestamp: rawMessage.timestamp,
        metadata: rawMessage.metadata || {},
      });

      // Track last interaction
      const existing = lastInteractionMap.get(contactId);
      if (!existing || rawMessage.timestamp > existing) {
        lastInteractionMap.set(contactId, rawMessage.timestamp);
      }

      // Batch insert every 500 messages
      if (messageBatch.length >= 500) {
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

    // Batch update last interactions
    if (lastInteractionMap.size > 0) {
      await db.$transaction(
        Array.from(lastInteractionMap.entries()).map(([id, timestamp]) =>
          db.contact.update({
            where: { id },
            data: { lastInteraction: timestamp },
          })
        )
      );
    }

    // Clean up the temp file
    try {
      await unlink(filePath);
    } catch {
      // Ignore cleanup errors
    }

    revalidatePath("/");
    revalidatePath("/contacts");

    return {
      success: true,
      messagesImported,
      contactsCreated,
    };
  } catch (error) {
    console.error("[import-whatsapp]", error);
    return {
      success: false,
      messagesImported: 0,
      contactsCreated: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Process a Facebook Messenger export
 */
export async function importFacebook(
  exportPath: string,
  userName?: string
): Promise<ImportResult> {
  // Validate file path to prevent arbitrary file access
  validateFilePath(exportPath);

  const { parseFacebookExport, extractFacebookContacts } = await import(
    "@/lib/connectors/facebook/parser"
  );

  try {
    const source: DataSourceType = "facebook";

    // Build identity index for faster lookups
    const identityIndex = await buildIdentityIndex();
    const contactIdMap = new Map<string, string>();

    // First, extract and create contacts
    let contactsCreated = 0;
    for await (const rawContact of extractFacebookContacts(exportPath, {
      userName,
    })) {
      const contactId = await findOrCreateContact(rawContact, source);
      const { normalized } = normalizeIdentifier(rawContact.identifier);
      contactIdMap.set(normalized, contactId);
      identityIndex.set(normalized, contactId);
      contactsCreated++;
    }

    // Then, import messages in batches
    let messagesImported = 0;
    const messageBatch: Array<{
      contactId: string;
      source: DataSourceType;
      type: "message" | "call" | "email";
      sourceMessageId: string | null;
      content: string | null;
      direction: "inbound" | "outbound";
      timestamp: Date;
      metadata: Record<string, unknown>;
    }> = [];

    const lastInteractionMap = new Map<string, Date>();

    for await (const rawMessage of parseFacebookExport(exportPath, {
      userName,
    })) {
      const { normalized } = normalizeIdentifier(rawMessage.senderIdentifier);
      let contactId = contactIdMap.get(normalized) || identityIndex.get(normalized);

      if (!contactId) {
        // Create contact on the fly
        contactId = await findOrCreateContact(
          {
            identifier: rawMessage.senderIdentifier,
            source,
          },
          source
        );
        contactIdMap.set(normalized, contactId);
        identityIndex.set(normalized, contactId);
      }

      messageBatch.push({
        contactId,
        source,
        type: rawMessage.type,
        sourceMessageId: rawMessage.sourceId,
        content: rawMessage.content,
        direction: rawMessage.direction,
        timestamp: rawMessage.timestamp,
        metadata: rawMessage.metadata || {},
      });

      // Track last interaction
      const existing = lastInteractionMap.get(contactId);
      if (!existing || rawMessage.timestamp > existing) {
        lastInteractionMap.set(contactId, rawMessage.timestamp);
      }

      // Batch insert every 500 messages
      if (messageBatch.length >= 500) {
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

    // Batch update last interactions
    if (lastInteractionMap.size > 0) {
      await db.$transaction(
        Array.from(lastInteractionMap.entries()).map(([id, timestamp]) =>
          db.contact.update({
            where: { id },
            data: { lastInteraction: timestamp },
          })
        )
      );
    }

    revalidatePath("/");
    revalidatePath("/contacts");

    return {
      success: true,
      messagesImported,
      contactsCreated,
    };
  } catch (error) {
    console.error("[import-facebook]", error);
    return {
      success: false,
      messagesImported: 0,
      contactsCreated: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Process an Instagram DM export
 */
export async function importInstagram(
  exportPath: string,
  userName?: string
): Promise<ImportResult> {
  // Validate file path to prevent arbitrary file access
  validateFilePath(exportPath);

  const { parseInstagramExport, extractInstagramContacts } = await import(
    "@/lib/connectors/instagram/parser"
  );

  try {
    const source: DataSourceType = "instagram";

    // Build identity index for faster lookups
    const identityIndex = await buildIdentityIndex();
    const contactIdMap = new Map<string, string>();

    // First, extract and create contacts
    let contactsCreated = 0;
    for await (const rawContact of extractInstagramContacts(exportPath, {
      userName,
    })) {
      const contactId = await findOrCreateContact(rawContact, source);
      const { normalized } = normalizeIdentifier(rawContact.identifier);
      contactIdMap.set(normalized, contactId);
      identityIndex.set(normalized, contactId);
      contactsCreated++;
    }

    // Then, import messages in batches
    let messagesImported = 0;
    const messageBatch: Array<{
      contactId: string;
      source: DataSourceType;
      type: "message" | "call" | "email";
      sourceMessageId: string | null;
      content: string | null;
      direction: "inbound" | "outbound";
      timestamp: Date;
      metadata: Record<string, unknown>;
    }> = [];

    const lastInteractionMap = new Map<string, Date>();

    for await (const rawMessage of parseInstagramExport(exportPath, {
      userName,
    })) {
      const { normalized } = normalizeIdentifier(rawMessage.senderIdentifier);
      let contactId = contactIdMap.get(normalized) || identityIndex.get(normalized);

      if (!contactId) {
        // Create contact on the fly
        contactId = await findOrCreateContact(
          {
            identifier: rawMessage.senderIdentifier,
            source,
          },
          source
        );
        contactIdMap.set(normalized, contactId);
        identityIndex.set(normalized, contactId);
      }

      messageBatch.push({
        contactId,
        source,
        type: rawMessage.type,
        sourceMessageId: rawMessage.sourceId,
        content: rawMessage.content,
        direction: rawMessage.direction,
        timestamp: rawMessage.timestamp,
        metadata: rawMessage.metadata || {},
      });

      // Track last interaction
      const existing = lastInteractionMap.get(contactId);
      if (!existing || rawMessage.timestamp > existing) {
        lastInteractionMap.set(contactId, rawMessage.timestamp);
      }

      // Batch insert every 500 messages
      if (messageBatch.length >= 500) {
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

    // Batch update last interactions
    if (lastInteractionMap.size > 0) {
      await db.$transaction(
        Array.from(lastInteractionMap.entries()).map(([id, timestamp]) =>
          db.contact.update({
            where: { id },
            data: { lastInteraction: timestamp },
          })
        )
      );
    }

    revalidatePath("/");
    revalidatePath("/contacts");

    return {
      success: true,
      messagesImported,
      contactsCreated,
    };
  } catch (error) {
    console.error("[import-instagram]", error);
    return {
      success: false,
      messagesImported: 0,
      contactsCreated: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get import source metadata
 */
export async function getImportSources() {
  return {
    whatsapp: {
      name: "WhatsApp",
      icon: "📱",
      description: "Import chat exports from WhatsApp",
      allowedExtensions: [".txt", ".zip"],
      instructions: "Settings > Chats > Export Chat > Without Media",
    },
    facebook: {
      name: "Facebook Messenger",
      icon: "👤",
      description: "Import message history from Facebook",
      allowedExtensions: [".json", ".zip"],
      instructions:
        "Settings > Your Facebook Information > Download Your Information > Messages (JSON)",
    },
    instagram: {
      name: "Instagram DMs",
      icon: "📷",
      description: "Import direct messages from Instagram",
      allowedExtensions: [".json", ".zip"],
      instructions:
        "Settings > Privacy and Security > Data Download > Request Download (JSON)",
    },
  };
}
