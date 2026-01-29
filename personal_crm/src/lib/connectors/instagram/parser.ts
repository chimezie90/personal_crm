import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { RawMessage, RawContact } from "../types";
import { fixMetaEncoding } from "../meta/encoding";

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
 * Parse a single Instagram message JSON file
 */
export async function parseInstagramMessageFile(
  filePath: string
): Promise<IGConversation> {
  const content = await readFile(filePath, "utf-8");
  const data = JSON.parse(content) as IGConversation;

  // Fix encoding for all string fields (Instagram has same encoding bug as Facebook)
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
 * Parse Instagram export and yield messages
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
    let conversation: IGConversation;
    try {
      conversation = await parseInstagramMessageFile(filePath);
    } catch (e) {
      console.warn(`Failed to parse ${filePath}: ${e}`);
      continue;
    }

    // Process messages (they're in reverse chronological order)
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

      // Add share indicator
      if (msg.share) {
        const shareText = msg.share.share_text || msg.share.link || "shared post";
        content = content ? `${content} [${shareText}]` : `[${shareText}]`;
      }

      yield {
        sourceId: `ig-${conversationName}-${msg.timestamp_ms}`,
        type: "message",
        content,
        direction: isOutbound ? "outbound" : "inbound",
        timestamp: new Date(msg.timestamp_ms),
        senderIdentifier: `ig:${msg.sender_name}`,
        metadata: {
          conversationTitle: conversation.title,
          conversationName,
          hasPhotos: !!msg.photos?.length,
          hasVideos: !!msg.videos?.length,
          hasShare: !!msg.share,
          reactions: msg.reactions,
          threadType: conversation.thread_type,
        },
      };
    }
  }
}

/**
 * Extract unique contacts from Instagram export
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
    let conversation: IGConversation;
    try {
      conversation = await parseInstagramMessageFile(filePath);
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
        identifier: `ig:${name}`,
        displayName: name,
        source: "instagram",
      };
    }
  }
}
