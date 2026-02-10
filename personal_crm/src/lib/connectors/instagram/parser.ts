import { createReadStream } from "fs";
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { parser } from "stream-json";
import { pick } from "stream-json/filters/Pick";
import { streamArray } from "stream-json/streamers/StreamArray";
import { streamObject } from "stream-json/streamers/StreamObject";
import { z } from "zod";
import { RawMessage, RawContact } from "../types";
import { fixMetaEncoding } from "../meta/encoding";

// ============================================================================
// Zod Schemas for Instagram Export Validation
// ============================================================================

/**
 * Schema for Instagram media object (photos/videos)
 */
const igMediaSchema = z.object({
  uri: z.string(),
  creation_timestamp: z.number().optional(),
});

/**
 * Schema for Instagram share object
 */
const igShareSchema = z.object({
  link: z.string().optional(),
  share_text: z.string().optional(),
});

/**
 * Schema for Instagram reaction object
 */
const igReactionSchema = z.object({
  reaction: z.string(),
  actor: z.string(),
});

/**
 * Schema for individual Instagram message
 * Validates the structure of messages from Instagram exports
 */
const igMessageSchema = z.object({
  sender_name: z.string(),
  timestamp_ms: z.number(),
  content: z.string().optional(),
  photos: z.array(igMediaSchema).optional(),
  videos: z.array(igMediaSchema).optional(),
  share: igShareSchema.optional(),
  reactions: z.array(igReactionSchema).optional(),
  is_unsent: z.boolean().optional(),
  type: z.string().optional(),
});

/**
 * Schema for Instagram participant object
 */
const igParticipantSchema = z.object({
  name: z.string(),
});

/**
 * Schema for Instagram conversation metadata
 */
const igConversationMetaSchema = z.object({
  title: z.string(),
  participants: z.array(igParticipantSchema),
  thread_type: z.string().optional(),
  thread_path: z.string().optional(),
});

/**
 * Schema for complete Instagram conversation (used in legacy parser)
 */
const igConversationSchema = igConversationMetaSchema.extend({
  messages: z.array(igMessageSchema),
});

// Export schema types for external use if needed
export type IGMessageSchema = z.infer<typeof igMessageSchema>;
export type IGConversationSchema = z.infer<typeof igConversationSchema>;

/**
 * Instagram DM export parser
 *
 * Instagram exports messages as JSON files in a similar structure to Facebook:
 * messages/inbox/<conversation_name>/message_1.json
 *
 * Each JSON file contains:
 * {
 *   participants: [{ name: string }],
 *   messages: [{
 *     sender_name: string,
 *     timestamp_ms: number,
 *     content?: string,
 *     share?: { link?: string, share_text?: string },
 *     photos?: [{ uri: string }],
 *     videos?: [{ uri: string }],
 *     ...
 *   }],
 *   ...
 * }
 */

export interface IGParticipant {
  name: string;
}

export interface IGPhoto {
  uri: string;
  creation_timestamp?: number;
}

export interface IGVideo {
  uri: string;
  creation_timestamp?: number;
}

export interface IGShare {
  link?: string;
  share_text?: string;
}

export interface IGReaction {
  reaction: string;
  actor: string;
}

export interface IGMessage {
  sender_name: string;
  timestamp_ms: number;
  content?: string;
  photos?: IGPhoto[];
  videos?: IGVideo[];
  share?: IGShare;
  reactions?: IGReaction[];
  is_unsent?: boolean;
  type?: string;
}

export interface IGConversation {
  participants: IGParticipant[];
  messages: IGMessage[];
  title: string;
  thread_type?: string;
  thread_path?: string;
}

export interface ParseOptions {
  /**
   * User's Instagram username to identify outbound messages
   */
  userName?: string;
}

/**
 * Fix encoding for a single Instagram message object
 */
function fixMessageEncoding(msg: IGMessage): IGMessage {
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
 * Custom error class for Instagram parse validation failures
 */
export class InstagramParseError extends Error {
  constructor(
    message: string,
    public readonly filePath: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "InstagramParseError";
  }
}

/**
 * Parse a single Instagram message JSON file (legacy - loads entire file)
 * @deprecated Use parseMessagesStreaming for large files
 */
export async function parseInstagramMessageFile(
  filePath: string
): Promise<IGConversation> {
  const content = await readFile(filePath, "utf-8");

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new InstagramParseError(
      `Invalid JSON in Instagram export file: ${e instanceof Error ? e.message : "Unknown error"}`,
      filePath,
      e
    );
  }

  // Validate with Zod
  const result = igConversationSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new InstagramParseError(
      `Invalid Instagram export structure: ${issues}`,
      filePath,
      result.error.issues
    );
  }

  const data = result.data;

  // Fix encoding for all string fields (Instagram has same encoding bug as Facebook)
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
 * Stream messages from an Instagram message JSON file one at a time
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
): AsyncGenerator<IGMessage> {
  const pipeline = createReadStream(filePath)
    .pipe(parser())
    .pipe(pick({ filter: "messages" }))
    .pipe(streamArray());

  let messageIndex = 0;
  for await (const { value } of pipeline) {
    const result = igMessageSchema.safeParse(value);

    if (!result.success) {
      const issues = result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ");
      const errorMsg = `[Instagram] Invalid message at index ${messageIndex} in ${filePath}: ${issues}`;

      if (options.skipInvalid) {
        console.warn(errorMsg);
        messageIndex++;
        continue;
      } else {
        throw new InstagramParseError(errorMsg, filePath, result.error.issues);
      }
    }

    messageIndex++;
    yield fixMessageEncoding(result.data);
  }
}

/**
 * Stream metadata (participants, title) from an Instagram message JSON file
 * Memory-efficient: only reads the metadata fields, not messages
 * All fields are validated with Zod before returning
 *
 * @param filePath - Path to the message JSON file
 * @returns Conversation metadata without messages
 */
export async function parseMetadataStreaming(
  filePath: string
): Promise<{ title: string; participants: IGParticipant[]; threadType?: string }> {
  return new Promise((resolve, reject) => {
    const metadata: {
      title?: string;
      participants?: IGParticipant[];
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
          console.warn(`[Instagram] Invalid title in ${filePath}: expected string, got ${typeof value}`);
          metadata.title = "";
        }
      } else if (key === "participants") {
        // Validate participants array
        const participantsResult = z.array(igParticipantSchema).safeParse(value);
        if (participantsResult.success) {
          metadata.participants = participantsResult.data.map((p) => ({
            name: fixMetaEncoding(p.name),
          }));
        } else {
          console.warn(
            `[Instagram] Invalid participants in ${filePath}: ${participantsResult.error.issues
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
          console.warn(`[Instagram] Invalid thread_type in ${filePath}: expected string`);
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
 * Find all message JSON files in an Instagram export directory
 *
 * @param exportPath - Path to Instagram export (containing messages/inbox/ or your_instagram_activity/messages/inbox/)
 */
export async function* findInstagramMessageFiles(
  exportPath: string
): AsyncGenerator<{ filePath: string; conversationName: string }> {
  // Instagram exports have various structures depending on when exported
  const possiblePaths = [
    join(exportPath, "messages", "inbox"),
    join(exportPath, "your_instagram_activity", "messages", "inbox"),
    join(exportPath, "inbox"),
    exportPath, // In case exportPath is already the inbox
  ];

  let inboxPath: string | null = null;

  for (const path of possiblePaths) {
    try {
      const entries = await readdir(path);
      if (entries.length > 0) {
        inboxPath = path;
        break;
      }
    } catch {
      continue;
    }
  }

  if (!inboxPath) {
    throw new Error(
      `Could not find Instagram messages at ${exportPath}. ` +
        "Expected structure: messages/inbox/<conversation>/"
    );
  }

  const conversations = await readdir(inboxPath);

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
      .sort();

    for (const file of messageFiles) {
      yield {
        filePath: join(conversationPath, file),
        conversationName: conversation,
      };
    }
  }
}

/**
 * Convert an Instagram message to RawMessage format
 */
function convertToRawMessage(
  msg: IGMessage,
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

  // Add share indicator
  if (msg.share) {
    const shareText = msg.share.share_text || msg.share.link || "shared post";
    content = content ? `${content} [${shareText}]` : `[${shareText}]`;
  }

  return {
    sourceId: `ig-${conversationName}-${msg.timestamp_ms}`,
    type: "message",
    content,
    direction: isOutbound ? "outbound" : "inbound",
    timestamp: new Date(msg.timestamp_ms),
    senderIdentifier: `ig:${msg.sender_name}`,
    metadata: {
      conversationTitle,
      conversationName,
      hasPhotos: !!msg.photos?.length,
      hasVideos: !!msg.videos?.length,
      hasShare: !!msg.share,
      reactions: msg.reactions,
      threadType,
    },
  };
}

/**
 * Parse Instagram export and yield messages using streaming JSON parser
 * Memory-efficient: processes messages without loading entire files into memory
 *
 * @param exportPath - Path to Instagram export directory
 * @param options - Parse options including user name
 */
export async function* parseInstagramExport(
  exportPath: string,
  options: ParseOptions = {}
): AsyncGenerator<RawMessage> {
  for await (const { filePath, conversationName } of findInstagramMessageFiles(
    exportPath
  )) {
    try {
      // Get metadata (title, participants) via streaming
      const metadata = await parseMetadataStreaming(filePath);

      // Stream messages - collect per file to reverse (Instagram stores reverse chronological)
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

      // Yield in chronological order (reverse of Instagram's order)
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
 * Parse Instagram export and yield messages in streaming order (no reversal)
 * Most memory-efficient option - yields messages as they are read
 * Note: Messages will be in reverse chronological order (newest first)
 *
 * @param exportPath - Path to Instagram export directory
 * @param options - Parse options including user name
 */
export async function* parseInstagramExportStreaming(
  exportPath: string,
  options: ParseOptions = {}
): AsyncGenerator<RawMessage> {
  for await (const { filePath, conversationName } of findInstagramMessageFiles(
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
 * Extract unique contacts from Instagram export using streaming parser
 * Memory-efficient: only reads participant metadata, not messages
 *
 * @param exportPath - Path to Instagram export directory
 * @param options - Parse options including user name
 */
export async function* extractInstagramContacts(
  exportPath: string,
  options: ParseOptions = {}
): AsyncGenerator<RawContact> {
  const seenNames = new Set<string>();

  for await (const { filePath } of findInstagramMessageFiles(exportPath)) {
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
          identifier: `ig:${name}`,
          displayName: name,
          source: "instagram",
        };
      }
    } catch {
      continue;
    }
  }
}
