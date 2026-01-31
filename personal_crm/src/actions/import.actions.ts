"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { DataSourceType, RawContact, RawMessage } from "@/lib/connectors/types";
import {
  findOrCreateContact,
  normalizeIdentifier,
  buildIdentityIndex,
} from "@/lib/services/deduplication-service";
import { createMessages } from "@/lib/services/message-service";
import { unlink } from "fs/promises";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { requireAuth } from "@/lib/auth";

/**
 * Secure upload directory - must match the one in /api/import/route.ts
 */
const UPLOAD_DIR = join(tmpdir(), "personal-crm-imports");

/**
 * Batch size for message inserts
 */
const MESSAGE_BATCH_SIZE = 500;

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
 * Configuration for a data source import
 */
interface ImportConfig<TOptions = unknown> {
  /** The data source type identifier */
  source: DataSourceType;
  /** Function that extracts contacts from the export */
  extractContacts: (path: string, options: TOptions) => AsyncGenerator<RawContact>;
  /** Function that parses messages from the export */
  parseMessages: (path: string, options: TOptions) => AsyncGenerator<RawMessage>;
  /** Optional: extract display name from message metadata for on-the-fly contact creation */
  getDisplayNameFromMessage?: (msg: RawMessage) => string | undefined;
  /** Whether to clean up the file after import (default: false) */
  cleanupFile?: boolean;
  /** Log prefix for error messages */
  logPrefix: string;
}

/**
 * Message batch entry for createMessages
 */
type MessageBatchEntry = {
  contactId: string;
  source: DataSourceType;
  type: "message" | "call" | "email";
  sourceMessageId: string | null;
  content: string | null;
  direction: "inbound" | "outbound";
  timestamp: Date;
  metadata: Record<string, unknown>;
};

/**
 * Generic import executor that handles the common import workflow:
 * 1. Authentication check
 * 2. File path validation
 * 3. Identity index building
 * 4. Contact extraction and creation
 * 5. Message streaming and batch processing
 * 6. Last interaction tracking
 * 7. Cache revalidation
 *
 * @param config - Import configuration for the specific data source
 * @param filePath - Path to the file/directory to import
 * @param options - Source-specific options passed to extractContacts and parseMessages
 */
async function executeImport<TOptions>(
  config: ImportConfig<TOptions>,
  filePath: string,
  options: TOptions
): Promise<ImportResult> {
  const { source, extractContacts, parseMessages, getDisplayNameFromMessage, cleanupFile, logPrefix } = config;

  // Step 1: Verify user is authenticated before processing import
  try {
    await requireAuth();
  } catch (error) {
    return {
      success: false,
      messagesImported: 0,
      contactsCreated: 0,
      error: error instanceof Error ? error.message : "Authentication required",
    };
  }

  // Step 2: Validate file path to prevent arbitrary file access
  validateFilePath(filePath);

  try {
    // Step 3: Build identity index for faster lookups
    const identityIndex = await buildIdentityIndex();
    const contactIdMap = new Map<string, string>();

    // Step 4: Extract and create contacts
    let contactsCreated = 0;
    for await (const rawContact of extractContacts(filePath, options)) {
      const contactId = await findOrCreateContact(rawContact, source);
      const { normalized } = normalizeIdentifier(rawContact.identifier);
      contactIdMap.set(normalized, contactId);
      identityIndex.set(normalized, contactId);
      contactsCreated++;
    }

    // Step 5: Import messages in batches
    let messagesImported = 0;
    const messageBatch: MessageBatchEntry[] = [];
    const lastInteractionMap = new Map<string, Date>();

    for await (const rawMessage of parseMessages(filePath, options)) {
      const { normalized } = normalizeIdentifier(rawMessage.senderIdentifier);
      let contactId = contactIdMap.get(normalized) || identityIndex.get(normalized);

      if (!contactId) {
        // Create contact on the fly
        const displayName = getDisplayNameFromMessage?.(rawMessage);
        contactId = await findOrCreateContact(
          {
            identifier: rawMessage.senderIdentifier,
            displayName,
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

      // Step 6: Track last interaction
      const existing = lastInteractionMap.get(contactId);
      if (!existing || rawMessage.timestamp > existing) {
        lastInteractionMap.set(contactId, rawMessage.timestamp);
      }

      // Batch insert every MESSAGE_BATCH_SIZE messages
      if (messageBatch.length >= MESSAGE_BATCH_SIZE) {
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

    // Clean up temp file if requested
    if (cleanupFile) {
      try {
        await unlink(filePath);
      } catch {
        // Ignore cleanup errors
      }
    }

    // Step 7: Revalidate cache
    revalidatePath("/");
    revalidatePath("/contacts");

    return {
      success: true,
      messagesImported,
      contactsCreated,
    };
  } catch (error) {
    console.error(`[${logPrefix}]`, error);
    return {
      success: false,
      messagesImported: 0,
      contactsCreated: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Process a WhatsApp export file
 */
export async function importWhatsApp(
  filePath: string,
  chatName: string,
  userIdentifier?: string
): Promise<ImportResult> {
  const { parseWhatsAppExport, extractWhatsAppContacts } = await import(
    "@/lib/connectors/whatsapp/parser"
  );

  // Create wrapper functions that include chatName in the options
  type WhatsAppOptions = { chatName: string; userIdentifier?: string };
  const options: WhatsAppOptions = { chatName, userIdentifier };

  return executeImport<WhatsAppOptions>(
    {
      source: "whatsapp",
      extractContacts: (path, opts) =>
        extractWhatsAppContacts(path, opts.chatName, { userIdentifier: opts.userIdentifier }),
      parseMessages: (path, opts) =>
        parseWhatsAppExport(path, opts.chatName, { userIdentifier: opts.userIdentifier }),
      getDisplayNameFromMessage: (msg) => msg.metadata?.originalAuthor as string | undefined,
      cleanupFile: true,
      logPrefix: "import-whatsapp",
    },
    filePath,
    options
  );
}

/**
 * Process a Facebook Messenger export
 */
export async function importFacebook(
  exportPath: string,
  userName?: string
): Promise<ImportResult> {
  const { parseFacebookExport, extractFacebookContacts } = await import(
    "@/lib/connectors/facebook/parser"
  );

  type FacebookOptions = { userName?: string };
  const options: FacebookOptions = { userName };

  return executeImport<FacebookOptions>(
    {
      source: "facebook",
      extractContacts: (path, opts) => extractFacebookContacts(path, opts),
      parseMessages: (path, opts) => parseFacebookExport(path, opts),
      logPrefix: "import-facebook",
    },
    exportPath,
    options
  );
}

/**
 * Process an Instagram DM export
 */
export async function importInstagram(
  exportPath: string,
  userName?: string
): Promise<ImportResult> {
  const { parseInstagramExport, extractInstagramContacts } = await import(
    "@/lib/connectors/instagram/parser"
  );

  type InstagramOptions = { userName?: string };
  const options: InstagramOptions = { userName };

  return executeImport<InstagramOptions>(
    {
      source: "instagram",
      extractContacts: (path, opts) => extractInstagramContacts(path, opts),
      parseMessages: (path, opts) => parseInstagramExport(path, opts),
      logPrefix: "import-instagram",
    },
    exportPath,
    options
  );
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
