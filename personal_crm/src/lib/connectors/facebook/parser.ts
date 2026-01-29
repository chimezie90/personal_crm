import { createReadStream } from "fs";
import { readdir, readFile } from "fs/promises";
import { join, basename } from "path";
import { RawMessage, RawContact } from "../types";
import { fixMetaEncoding } from "../meta/encoding";

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
 * Parse a single Facebook message JSON file
 * Uses streaming-friendly approach by reading file once
 */
export async function parseFacebookMessageFile(
  filePath: string
): Promise<FBConversation> {
  const content = await readFile(filePath, "utf-8");
  const data = JSON.parse(content) as FBConversation;

  // Fix encoding for all string fields
  return {
    ...data,
    title: fixMetaEncoding(data.title),
    participants: data.participants.map((p) => ({
      name: fixMetaEncoding(p.name),
    })),
    messages: data.messages.map((msg) => ({
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
    })),
  };
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
 * Parse Facebook export and yield messages
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
    let conversation: FBConversation;
    try {
      conversation = await parseFacebookMessageFile(filePath);
    } catch (e) {
      console.warn(`Failed to parse ${filePath}: ${e}`);
      continue;
    }

    // Process messages (they're in reverse chronological order in Facebook exports)
    const messages = [...conversation.messages].reverse();

    for (const msg of messages) {
      // Skip unsent messages
      if (msg.is_unsent) continue;

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

      yield {
        sourceId: `fb-${conversationName}-${msg.timestamp_ms}`,
        type: "message",
        content,
        direction: isOutbound ? "outbound" : "inbound",
        timestamp: new Date(msg.timestamp_ms),
        senderIdentifier: `fb:${msg.sender_name}`,
        metadata: {
          conversationTitle: conversation.title,
          conversationName,
          hasPhotos: !!msg.photos?.length,
          hasVideos: !!msg.videos?.length,
          hasSticker: !!msg.sticker,
          hasShare: !!msg.share,
          reactions: msg.reactions,
          threadType: conversation.thread_type,
        },
      };
    }
  }
}

/**
 * Extract unique contacts from Facebook export
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
    let conversation: FBConversation;
    try {
      conversation = await parseFacebookMessageFile(filePath);
    } catch {
      continue;
    }

    for (const participant of conversation.participants) {
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
  }
}
