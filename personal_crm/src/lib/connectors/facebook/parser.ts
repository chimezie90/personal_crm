import { createReadStream } from "fs";
import { readdir, readFile } from "fs/promises";
import { join, basename } from "path";
import { parser } from "stream-json";
import { pick } from "stream-json/filters/Pick";
import { streamArray } from "stream-json/streamers/StreamArray";
import { streamObject } from "stream-json/streamers/StreamObject";
import { z } from "zod";
import { RawMessage, RawContact } from "../types";
import { fixMetaEncoding } from "../meta/encoding";

// ============================================================================
// Zod Schemas for Facebook Export Validation
// ============================================================================

/**
 * Schema for Facebook reaction object
 */
const fbReactionSchema = z.object({
  reaction: z.string(),
  actor: z.string(),
});

/**
 * Schema for Facebook photo/video media object
 */
const fbMediaSchema = z.object({
  uri: z.string(),
  creation_timestamp: z.number().optional(),
});

/**
 * Schema for Facebook sticker object
 */
const fbStickerSchema = z.object({
  uri: z.string(),
});

/**
 * Schema for Facebook share object
 */
const fbShareSchema = z.object({
  link: z.string().optional(),
  share_text: z.string().optional(),
});

/**
 * Schema for individual Facebook message
 * Validates the structure of messages from Facebook exports
 */
const fbMessageSchema = z.object({
  sender_name: z.string(),
  timestamp_ms: z.number(),
  content: z.string().optional(),
  photos: z.array(fbMediaSchema).optional(),
  videos: z.array(fbMediaSchema).optional(),
  reactions: z.array(fbReactionSchema).optional(),
  sticker: fbStickerSchema.optional(),
  share: fbShareSchema.optional(),
  is_unsent: z.boolean().optional(),
  type: z.string().optional(),
});

/**
 * Schema for Facebook participant object
 */
const fbParticipantSchema = z.object({
  name: z.string(),
});

/**
 * Schema for Facebook conversation metadata
 */
const fbConversationMetaSchema = z.object({
  title: z.string(),
  participants: z.array(fbParticipantSchema),
  thread_type: z.string().optional(),
  thread_path: z.string().optional(),
});

/**
 * Schema for complete Facebook conversation (used in legacy parser)
 */
const fbConversationSchema = fbConversationMetaSchema.extend({
  messages: z.array(fbMessageSchema),
});

// Export schema types for external use if needed
export type FBMessageSchema = z.infer<typeof fbMessageSchema>;
export type FBConversationSchema = z.infer<typeof fbConversationSchema>;

/**
 * Facebook Messenger export parser
 *
 * Facebook exports messages as JSON files in the structure:
 * messages/inbox/<conversation_name>/message_1.json
 *
 * Each JSON file contains:
 * {
 *   participants: [{ name: string }],
 *   messages: [{
 *     sender_name: string,
 *     timestamp_ms: number,
 *     content?: string,
 *     photos?: [{ uri: string }],
 *     videos?: [{ uri: string }],
 *     reactions?: [{ reaction: string, actor: string }],
 *     ...
 *   }],
 *   ...
 * }
 */

export interface FBParticipant {
  name: string;
}

export interface FBReaction {
  reaction: string;
  actor: string;
}

export interface FBPhoto {
  uri: string;
  creation_timestamp?: number;
}

export interface FBVideo {
  uri: string;
  creation_timestamp?: number;
}

export interface FBMessage {
  sender_name: string;
  timestamp_ms: number;
  content?: string;
  photos?: FBPhoto[];
  videos?: FBVideo[];
  reactions?: FBReaction[];
  sticker?: { uri: string };
  share?: { link?: string; share_text?: string };
  is_unsent?: boolean;
  type?: string;
}

export interface FBConversation {
  participants: FBParticipant[];
  messages: FBMessage[];
  title: string;
  thread_type?: string;
  thread_path?: string;
}

export interface ParseOptions {
  /**
   * User's Facebook name to identify outbound messages
   */
  userName?: string;
}

/**
 * Fix encoding for a single message object
 */
function fixMessageEncoding(msg: FBMessage): FBMessage {
  return {
    ...msg,
    sender_name: fixMetaEncoding(msg.sender_name),
    content: msg.content ? fixMetaEncoding(msg.content) : undefined,
    reactions: msg.reactions?.map((r) => ({
      reaction: fixMetaEncoding(r.reaction),
      actor: fixMetaEncoding(r.actor),
    })),
    share: msg.share
      ? {
          ...msg.share,
          share_text: msg.share.share_text
            ? fixMetaEncoding(msg.share.share_text)
            : undefined,
        }
      : undefined,
  };
}

/**
 * Custom error class for Facebook parse validation failures
 */
export class FacebookParseError extends Error {
  constructor(
    message: string,
    public readonly filePath: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "FacebookParseError";
  }
}

/**
 * Parse a single Facebook message JSON file (legacy - loads entire file)
 * @deprecated Use parseMessageFileStreaming for large files
 */
export async function parseFacebookMessageFile(
  filePath: string
): Promise<FBConversation> {
  const content = await readFile(filePath, "utf-8");

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new FacebookParseError(
      `Invalid JSON in Facebook export file: ${e instanceof Error ? e.message : "Unknown error"}`,
      filePath,
      e
    );
  }

  // Validate with Zod
  const result = fbConversationSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new FacebookParseError(
      `Invalid Facebook export structure: ${issues}`,
      filePath,
      result.error.issues
    );
  }

  const data = result.data;

  // Fix encoding for all string fields
  return {
    ...data,
    title: fixMetaEncoding(data.title),
    participants: data.participants.map((p) => ({
      name: fixMetaEncoding(p.name),
    })),
    messages: data.messages.map((msg) => fixMessageEncoding(msg)),
  };
}

/**
 * Stream messages from a Facebook message JSON file one at a time
 * Memory-efficient: processes messages without loading entire file
 * Each message is validated with Zod before yielding
 *
 * @param filePath - Path to the message JSON file
 * @param options - Options for handling validation errors
 * @yields Individual messages with fixed encoding
 */
export async function* parseMessagesStreaming(
  filePath: string,
  options: { skipInvalid?: boolean } = { skipInvalid: true }
): AsyncGenerator<FBMessage> {
  const pipeline = createReadStream(filePath)
    .pipe(parser())
    .pipe(pick({ filter: "messages" }))
    .pipe(streamArray());

  let messageIndex = 0;
  for await (const { value } of pipeline) {
    const result = fbMessageSchema.safeParse(value);

    if (!result.success) {
      const issues = result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ");
      const errorMsg = `[Facebook] Invalid message at index ${messageIndex} in ${filePath}: ${issues}`;

      if (options.skipInvalid) {
        console.warn(errorMsg);
        messageIndex++;
        continue;
      } else {
        throw new FacebookParseError(errorMsg, filePath, result.error.issues);
      }
    }

    messageIndex++;
    yield fixMessageEncoding(result.data);
  }
}

/**
 * Stream metadata (participants, title) from a Facebook message JSON file
 * Memory-efficient: only reads the metadata fields, not messages
 * All fields are validated with Zod before returning
 *
 * @param filePath - Path to the message JSON file
 * @returns Conversation metadata without messages
 */
export async function parseMetadataStreaming(
  filePath: string
): Promise<{ title: string; participants: FBParticipant[]; threadType?: string }> {
  return new Promise((resolve, reject) => {
    const metadata: {
      title?: string;
      participants?: FBParticipant[];
      thread_type?: string;
    } = {};

    const pipeline = createReadStream(filePath)
      .pipe(parser())
      .pipe(streamObject());

    pipeline.on("data", ({ key, value }: { key: string; value: unknown }) => {
      if (key === "title") {
        // Validate title is a string
        const titleResult = z.string().safeParse(value);
        if (titleResult.success) {
          metadata.title = fixMetaEncoding(titleResult.data);
        } else {
          console.warn(`[Facebook] Invalid title in ${filePath}: expected string, got ${typeof value}`);
          metadata.title = "";
        }
      } else if (key === "participants") {
        // Validate participants array
        const participantsResult = z.array(fbParticipantSchema).safeParse(value);
        if (participantsResult.success) {
          metadata.participants = participantsResult.data.map((p) => ({
            name: fixMetaEncoding(p.name),
          }));
        } else {
          console.warn(
            `[Facebook] Invalid participants in ${filePath}: ${participantsResult.error.issues
              .map((i) => i.message)
              .join("; ")}`
          );
          metadata.participants = [];
        }
      } else if (key === "thread_type") {
        // Validate thread_type is a string
        const threadTypeResult = z.string().safeParse(value);
        if (threadTypeResult.success) {
          metadata.thread_type = threadTypeResult.data;
        } else {
          console.warn(`[Facebook] Invalid thread_type in ${filePath}: expected string`);
        }
      }
    });

    pipeline.on("end", () => {
      resolve({
        title: metadata.title || "",
        participants: metadata.participants || [],
        threadType: metadata.thread_type,
      });
    });

    pipeline.on("error", reject);
  });
}

/**
 * Find all message JSON files in a Facebook export directory
 *
 * @param exportPath - Path to Facebook export (containing messages/inbox/)
 */
export async function* findFacebookMessageFiles(
  exportPath: string
): AsyncGenerator<{ filePath: string; conversationName: string }> {
  const inboxPath = join(exportPath, "messages", "inbox");

  let conversations: string[];
  try {
    conversations = await readdir(inboxPath);
  } catch {
    // Try if exportPath is already the inbox directory
    try {
      conversations = await readdir(exportPath);
    } catch {
      throw new Error(
        `Could not find Facebook messages at ${exportPath}. ` +
          "Expected structure: messages/inbox/<conversation>/"
      );
    }
  }

  for (const conversation of conversations) {
    const conversationPath = join(inboxPath, conversation);

    let files: string[];
    try {
      files = await readdir(conversationPath);
    } catch {
      continue; // Skip non-directories
    }

    // Find all message_*.json files
    const messageFiles = files
      .filter((f) => f.startsWith("message_") && f.endsWith(".json"))
      .sort(); // Sort to process in order

    for (const file of messageFiles) {
      yield {
        filePath: join(conversationPath, file),
        conversationName: conversation,
      };
    }
  }
}

/**
 * Convert a Facebook message to RawMessage format
 */
function convertToRawMessage(
  msg: FBMessage,
  conversationName: string,
  conversationTitle: string,
  threadType: string | undefined,
  options: ParseOptions
): RawMessage | null {
  // Skip unsent messages
  if (msg.is_unsent) return null;

  // Determine direction
  const isOutbound = options.userName
    ? msg.sender_name.toLowerCase() === options.userName.toLowerCase()
    : false;

  // Build content from various message types
  let content = msg.content || null;

  // Add photo indicator
  if (msg.photos?.length) {
    content = content
      ? `${content} [${msg.photos.length} photo(s)]`
      : `[${msg.photos.length} photo(s)]`;
  }

  // Add video indicator
  if (msg.videos?.length) {
    content = content
      ? `${content} [${msg.videos.length} video(s)]`
      : `[${msg.videos.length} video(s)]`;
  }

  // Add sticker indicator
  if (msg.sticker) {
    content = content ? `${content} [sticker]` : "[sticker]";
  }

  // Add share indicator
  if (msg.share) {
    const shareText = msg.share.share_text || msg.share.link || "shared";
    content = content ? `${content} [${shareText}]` : `[${shareText}]`;
  }

  return {
    sourceId: `fb-${conversationName}-${msg.timestamp_ms}`,
    type: "message",
    content,
    direction: isOutbound ? "outbound" : "inbound",
    timestamp: new Date(msg.timestamp_ms),
    senderIdentifier: `fb:${msg.sender_name}`,
    metadata: {
      conversationTitle,
      conversationName,
      hasPhotos: !!msg.photos?.length,
      hasVideos: !!msg.videos?.length,
      hasSticker: !!msg.sticker,
      hasShare: !!msg.share,
      reactions: msg.reactions,
      threadType,
    },
  };
}

/**
 * Parse Facebook export and yield messages using streaming JSON parser
 * Memory-efficient: processes messages without loading entire files into memory
 *
 * @param exportPath - Path to Facebook export directory or inbox directory
 * @param options - Parse options including user name
 */
export async function* parseFacebookExport(
  exportPath: string,
  options: ParseOptions = {}
): AsyncGenerator<RawMessage> {
  for await (const { filePath, conversationName } of findFacebookMessageFiles(
    exportPath
  )) {
    try {
      // Get metadata (title, participants) via streaming
      const metadata = await parseMetadataStreaming(filePath);

      // Stream messages - collect per file to reverse (Facebook stores reverse chronological)
      // For very large single files, this still uses less memory than loading the entire JSON
      const fileMessages: RawMessage[] = [];

      for await (const msg of parseMessagesStreaming(filePath)) {
        const rawMsg = convertToRawMessage(
          msg,
          conversationName,
          metadata.title,
          metadata.threadType,
          options
        );
        if (rawMsg) {
          fileMessages.push(rawMsg);
        }
      }

      // Yield in chronological order (reverse of Facebook's order)
      for (let i = fileMessages.length - 1; i >= 0; i--) {
        yield fileMessages[i];
      }
    } catch (e) {
      console.warn(`Failed to parse ${filePath}: ${e}`);
      continue;
    }
  }
}

/**
 * Parse Facebook export and yield messages in streaming order (no reversal)
 * Most memory-efficient option - yields messages as they are read
 * Note: Messages will be in reverse chronological order (newest first)
 *
 * @param exportPath - Path to Facebook export directory or inbox directory
 * @param options - Parse options including user name
 */
export async function* parseFacebookExportStreaming(
  exportPath: string,
  options: ParseOptions = {}
): AsyncGenerator<RawMessage> {
  for await (const { filePath, conversationName } of findFacebookMessageFiles(
    exportPath
  )) {
    try {
      // Get metadata (title, participants) via streaming
      const metadata = await parseMetadataStreaming(filePath);

      // Stream messages directly without collecting
      for await (const msg of parseMessagesStreaming(filePath)) {
        const rawMsg = convertToRawMessage(
          msg,
          conversationName,
          metadata.title,
          metadata.threadType,
          options
        );
        if (rawMsg) {
          yield rawMsg;
        }
      }
    } catch (e) {
      console.warn(`Failed to parse ${filePath}: ${e}`);
      continue;
    }
  }
}

/**
 * Extract unique contacts from Facebook export using streaming parser
 * Memory-efficient: only reads participant metadata, not messages
 *
 * @param exportPath - Path to Facebook export directory
 * @param options - Parse options including user name
 */
export async function* extractFacebookContacts(
  exportPath: string,
  options: ParseOptions = {}
): AsyncGenerator<RawContact> {
  const seenNames = new Set<string>();

  for await (const { filePath } of findFacebookMessageFiles(exportPath)) {
    try {
      // Use streaming to get only metadata (participants)
      const metadata = await parseMetadataStreaming(filePath);

      for (const participant of metadata.participants) {
        const name = participant.name;

        // Skip if already seen or is the user
        if (seenNames.has(name)) continue;
        if (
          options.userName &&
          name.toLowerCase() === options.userName.toLowerCase()
        ) {
          continue;
        }

        seenNames.add(name);

        yield {
          identifier: `fb:${name}`,
          displayName: name,
          source: "facebook",
        };
      }
    } catch {
      continue;
    }
  }
}
