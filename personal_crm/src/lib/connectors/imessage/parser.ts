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
  chat_rowid: number | null;
  chat_guid: string | null;
  chat_identifier: string | null;
  chat_display_name: string | null;
  chat_handle_count: number | null;
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
  if (!row.content) {
    return null;
  }

  const chatHandleCount = row.chat_handle_count ?? 0;
  const isGroup = chatHandleCount > 1;
  const chatKey =
    row.chat_identifier ||
    row.chat_guid ||
    row.chat_display_name ||
    (row.chat_rowid ? String(row.chat_rowid) : null);

  if (!isGroup && !row.handle_id) {
    return null;
  }

  return {
    sourceId: row.guid,
    content: row.content,
    timestamp: macAbsoluteTimeToDate(row.date),
    direction: row.is_from_me === 1 ? "outbound" : "inbound",
    senderIdentifier: isGroup
      ? `group:${chatKey ?? "unknown"}`
      : (row.handle_id as string),
    type: "message",
    metadata: {
      service: row.service,
      handleService: row.handle_service,
      isGroup,
      chatIdentifier: row.chat_identifier,
      chatGuid: row.chat_guid,
      chatDisplayName: row.chat_display_name,
      chatRowId: row.chat_rowid,
      chatHandleCount,
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
