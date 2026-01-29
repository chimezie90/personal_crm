import { createReadStream } from "fs";
import { createInterface } from "readline";
import { RawMessage, RawContact } from "../types";

/**
 * WhatsApp chat export parser
 *
 * WhatsApp exports chats as text files with the format:
 * [MM/DD/YY, HH:MM:SS AM/PM] Author: Message
 * or
 * DD/MM/YYYY, HH:MM - Author: Message
 *
 * The format varies by device locale.
 */

// Common date patterns in WhatsApp exports
const DATE_PATTERNS = [
  // US format: [MM/DD/YY, HH:MM:SS AM/PM]
  /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s*(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)\]\s*/i,
  // European format: DD/MM/YYYY, HH:MM -
  /^(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*-\s*/,
  // ISO-ish format: YYYY-MM-DD, HH:MM:SS
  /^\[?(\d{4}-\d{2}-\d{2}),?\s*(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*-?\s*/,
];

// System message patterns to filter out
const SYSTEM_MESSAGE_PATTERNS = [
  /Messages and calls are end-to-end encrypted/i,
  /created group/i,
  /added you/i,
  /left the group/i,
  /changed the subject/i,
  /changed this group's icon/i,
  /deleted this group's icon/i,
  /removed you/i,
  /You're now an admin/i,
  /\u200e/g, // Left-to-right mark often used in system messages
];

export interface WhatsAppMessage {
  date: Date;
  author: string | null;
  message: string;
  isSystemMessage: boolean;
}

export interface ParseOptions {
  /**
   * User's phone number or name to identify outbound messages
   */
  userIdentifier?: string;

  /**
   * Force date parsing order: true = day first (DD/MM), false = month first (MM/DD)
   * If not set, attempts to auto-detect
   */
  daysFirst?: boolean;
}

/**
 * Parse a date string from WhatsApp export
 */
function parseWhatsAppDate(
  dateStr: string,
  timeStr: string,
  daysFirst?: boolean
): Date | null {
  try {
    // Clean up the strings
    const cleanDate = dateStr.replace(/[\[\]]/g, "").trim();
    const cleanTime = timeStr.trim();

    // Parse date parts
    const dateParts = cleanDate.split(/[\/\-]/);
    if (dateParts.length !== 3) return null;

    let year: number;
    let month: number;
    let day: number;

    // Check if first part is year (ISO format)
    if (dateParts[0].length === 4) {
      year = parseInt(dateParts[0], 10);
      month = parseInt(dateParts[1], 10);
      day = parseInt(dateParts[2], 10);
    } else {
      // Determine day/month order
      const first = parseInt(dateParts[0], 10);
      const second = parseInt(dateParts[1], 10);
      const third = parseInt(dateParts[2], 10);

      year = third < 100 ? 2000 + third : third;

      if (daysFirst === true) {
        day = first;
        month = second;
      } else if (daysFirst === false) {
        month = first;
        day = second;
      } else {
        // Auto-detect: if first > 12, it must be day
        if (first > 12) {
          day = first;
          month = second;
        } else if (second > 12) {
          month = first;
          day = second;
        } else {
          // Ambiguous - default to month first (US format)
          month = first;
          day = second;
        }
      }
    }

    // Parse time
    let hours: number;
    let minutes: number;
    let seconds = 0;

    const timeParts = cleanTime.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?/i);
    if (!timeParts) return null;

    hours = parseInt(timeParts[1], 10);
    minutes = parseInt(timeParts[2], 10);
    if (timeParts[3]) seconds = parseInt(timeParts[3], 10);

    // Handle AM/PM
    if (timeParts[4]) {
      const isPM = timeParts[4].toUpperCase() === "PM";
      if (isPM && hours !== 12) hours += 12;
      if (!isPM && hours === 12) hours = 0;
    }

    return new Date(year, month - 1, day, hours, minutes, seconds);
  } catch {
    return null;
  }
}

/**
 * Check if a message is a system message
 */
function isSystemMessage(content: string): boolean {
  return SYSTEM_MESSAGE_PATTERNS.some((pattern) => pattern.test(content));
}

/**
 * Parse a single line from WhatsApp export
 */
function parseLine(
  line: string,
  options: ParseOptions
): { date: Date; author: string | null; message: string } | null {
  for (const pattern of DATE_PATTERNS) {
    const match = line.match(pattern);
    if (match) {
      const dateStr = match[1];
      const timeStr = match[2];
      const rest = line.slice(match[0].length);

      const date = parseWhatsAppDate(dateStr, timeStr, options.daysFirst);
      if (!date) continue;

      // Split author and message
      const colonIndex = rest.indexOf(": ");
      if (colonIndex === -1) {
        // System message (no author)
        return { date, author: null, message: rest.trim() };
      }

      const author = rest.slice(0, colonIndex).trim();
      const message = rest.slice(colonIndex + 2);

      return { date, author, message };
    }
  }
  return null;
}

/**
 * Normalize phone number for consistent matching
 */
function normalizePhone(phone: string): string {
  // Remove all non-digit characters except leading +
  const cleaned = phone.replace(/[^\d+]/g, "");

  // If it starts with +, keep it; otherwise normalize
  if (cleaned.startsWith("+")) {
    return cleaned;
  }

  // Remove leading 0 if present (local format)
  const withoutLeadingZero = cleaned.replace(/^0+/, "");

  // Return with + prefix if it looks like an international number
  if (withoutLeadingZero.length >= 10) {
    return `+${withoutLeadingZero}`;
  }

  return cleaned;
}

/**
 * Parse WhatsApp export file streaming (memory efficient)
 *
 * @param filePath - Path to the exported .txt file
 * @param chatName - Name of the chat (usually the filename)
 * @param options - Parse options including user identifier
 */
export async function* parseWhatsAppExport(
  filePath: string,
  chatName: string,
  options: ParseOptions = {}
): AsyncGenerator<RawMessage> {
  const rl = createInterface({
    input: createReadStream(filePath, { encoding: "utf-8" }),
    crlfDelay: Infinity,
  });

  let currentMessage: {
    date: Date;
    author: string | null;
    message: string;
  } | null = null;

  let messageIndex = 0;

  for await (const line of rl) {
    const parsed = parseLine(line, options);

    if (parsed) {
      // New message found - yield previous if exists
      if (currentMessage && !isSystemMessage(currentMessage.message)) {
        const isOutbound = options.userIdentifier
          ? currentMessage.author === options.userIdentifier ||
            normalizePhone(currentMessage.author || "") ===
              normalizePhone(options.userIdentifier)
          : false;

        yield {
          sourceId: `wa-${chatName}-${currentMessage.date.getTime()}-${messageIndex}`,
          type: "message",
          content: currentMessage.message,
          direction: isOutbound ? "outbound" : "inbound",
          timestamp: currentMessage.date,
          senderIdentifier: currentMessage.author
            ? normalizePhone(currentMessage.author)
            : `group:${chatName}`,
          metadata: {
            chatName,
            originalAuthor: currentMessage.author,
          },
        };
        messageIndex++;
      }

      currentMessage = parsed;
    } else if (currentMessage) {
      // Continuation of previous message (multi-line)
      currentMessage.message += "\n" + line;
    }
  }

  // Yield last message
  if (currentMessage && !isSystemMessage(currentMessage.message)) {
    const isOutbound = options.userIdentifier
      ? currentMessage.author === options.userIdentifier ||
        normalizePhone(currentMessage.author || "") ===
          normalizePhone(options.userIdentifier)
      : false;

    yield {
      sourceId: `wa-${chatName}-${currentMessage.date.getTime()}-${messageIndex}`,
      type: "message",
      content: currentMessage.message,
      direction: isOutbound ? "outbound" : "inbound",
      timestamp: currentMessage.date,
      senderIdentifier: currentMessage.author
        ? normalizePhone(currentMessage.author)
        : `group:${chatName}`,
      metadata: {
        chatName,
        originalAuthor: currentMessage.author,
      },
    };
  }
}

/**
 * Extract unique contacts from WhatsApp export
 *
 * @param filePath - Path to the exported .txt file
 * @param chatName - Name of the chat
 * @param options - Parse options
 */
export async function* extractWhatsAppContacts(
  filePath: string,
  chatName: string,
  options: ParseOptions = {}
): AsyncGenerator<RawContact> {
  const seenAuthors = new Set<string>();

  const rl = createInterface({
    input: createReadStream(filePath, { encoding: "utf-8" }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const parsed = parseLine(line, options);

    if (parsed && parsed.author && !seenAuthors.has(parsed.author)) {
      seenAuthors.add(parsed.author);

      // Skip if this is the user's own identifier
      if (
        options.userIdentifier &&
        (parsed.author === options.userIdentifier ||
          normalizePhone(parsed.author) ===
            normalizePhone(options.userIdentifier))
      ) {
        continue;
      }

      yield {
        identifier: normalizePhone(parsed.author),
        displayName: parsed.author,
        source: "whatsapp",
      };
    }
  }
}
