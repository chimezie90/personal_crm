import { RawMessage, RawContact } from "../types";
import { macAbsoluteTimeToDate } from "./queries";

/**
 * Raw row from iMessage database message query
 */
export interface IMessageRow {
  id: number;
  guid: string;
  content: string | null;
  date: number;
  is_from_me: number;
  service: string;
  handle_id: string | null;
  handle_service: string | null;
}

/**
 * Raw row from iMessage database handle query
 */
export interface IHandleRow {
  id: number;
  identifier: string;
  service: string;
  uncanonicalized_id: string | null;
}

/**
 * Parse a message row from iMessage database into RawMessage format
 */
export function parseMessageRow(row: IMessageRow): RawMessage | null {
  // Skip messages without content or handle
  if (!row.content || !row.handle_id) {
    return null;
  }

  return {
    sourceId: row.guid,
    content: row.content,
    timestamp: macAbsoluteTimeToDate(row.date),
    direction: row.is_from_me === 1 ? "outbound" : "inbound",
    senderIdentifier: row.handle_id,
    type: "message",
    metadata: {
      service: row.service,
      handleService: row.handle_service,
    },
  };
}

/**
 * Parse a handle row from iMessage database into RawContact format
 */
export function parseHandleRow(row: IHandleRow): RawContact {
  return {
    identifier: row.identifier,
    displayName: undefined, // iMessage doesn't store display names in chat.db
    source: "imessage",
  };
}

/**
 * Normalize a phone number or email identifier
 */
export function normalizeIdentifier(identifier: string): string {
  // Check if it's an email
  if (identifier.includes("@")) {
    return identifier.toLowerCase().trim();
  }

  // It's a phone number - normalize it
  // Remove all non-numeric characters except +
  const cleaned = identifier.replace(/[^\d+]/g, "");

  // Handle international prefixes
  // Remove leading + and country code 1 for US numbers
  if (cleaned.startsWith("+1") && cleaned.length === 12) {
    return cleaned.slice(2);
  }
  if (cleaned.startsWith("1") && cleaned.length === 11) {
    return cleaned.slice(1);
  }

  // For other formats, just return the last 10 digits if available
  if (cleaned.length >= 10) {
    return cleaned.slice(-10);
  }

  return cleaned;
}
