/**
 * SQL queries for reading from the iMessage database (chat.db)
 *
 * The iMessage database uses a complex schema with:
 * - message: Contains all messages
 * - handle: Contains contact identifiers (phone/email)
 * - chat: Contains conversation threads
 * - chat_message_join: Links messages to chats
 * - chat_handle_join: Links handles to chats
 */

/**
 * Query to get messages with handle information
 * The is_from_me column: 1 = outbound, 0 = inbound
 * The date column is in nanoseconds since 2001-01-01 (Mac Absolute Time)
 */
export const GET_MESSAGES_QUERY = `
  SELECT
    m.ROWID as id,
    m.guid as guid,
    m.text as content,
    m.date as date,
    m.is_from_me as is_from_me,
    m.service as service,
    h.id as handle_id,
    h.service as handle_service
  FROM message m
  LEFT JOIN handle h ON m.handle_id = h.ROWID
  WHERE m.text IS NOT NULL
    AND m.text != ''
    AND m.date > ?
  ORDER BY m.date ASC
  LIMIT ?
`;

/**
 * Query to get messages for incremental sync
 */
export const GET_MESSAGES_SINCE_QUERY = `
  SELECT
    m.ROWID as id,
    m.guid as guid,
    m.text as content,
    m.date as date,
    m.is_from_me as is_from_me,
    m.service as service,
    h.id as handle_id,
    h.service as handle_service
  FROM message m
  LEFT JOIN handle h ON m.handle_id = h.ROWID
  WHERE m.text IS NOT NULL
    AND m.text != ''
    AND m.date > ?
  ORDER BY m.date ASC
`;

/**
 * Query to get all unique handles (contacts)
 */
export const GET_HANDLES_QUERY = `
  SELECT
    h.ROWID as id,
    h.id as identifier,
    h.service as service,
    h.uncanonicalized_id as uncanonicalized_id
  FROM handle h
  WHERE h.id IS NOT NULL
    AND h.id != ''
`;

/**
 * Query to count total messages
 */
export const COUNT_MESSAGES_QUERY = `
  SELECT COUNT(*) as count
  FROM message
  WHERE text IS NOT NULL
    AND text != ''
`;

/**
 * Query to get the latest message date
 */
export const GET_LATEST_MESSAGE_DATE_QUERY = `
  SELECT MAX(date) as latest_date
  FROM message
  WHERE text IS NOT NULL
    AND text != ''
`;

/**
 * Convert Mac Absolute Time (nanoseconds since 2001-01-01) to JavaScript Date
 * Mac Absolute Time is the number of nanoseconds since 2001-01-01 00:00:00 UTC
 */
export function macAbsoluteTimeToDate(macTime: number): Date {
  // Mac epoch is 2001-01-01 00:00:00 UTC
  const MAC_EPOCH_MS = Date.UTC(2001, 0, 1);

  // macTime is in nanoseconds, convert to milliseconds
  // Some databases store in seconds, some in nanoseconds
  // Check if the number is reasonably sized (nanoseconds will be > 10^18)
  let milliseconds: number;

  if (macTime > 1e15) {
    // Nanoseconds format
    milliseconds = macTime / 1e6;
  } else if (macTime > 1e12) {
    // Microseconds format (some older versions)
    milliseconds = macTime / 1e3;
  } else {
    // Seconds format
    milliseconds = macTime * 1000;
  }

  return new Date(MAC_EPOCH_MS + milliseconds);
}

/**
 * Convert JavaScript Date to Mac Absolute Time (nanoseconds)
 */
export function dateToMacAbsoluteTime(date: Date): number {
  const MAC_EPOCH_MS = Date.UTC(2001, 0, 1);
  const diffMs = date.getTime() - MAC_EPOCH_MS;
  return diffMs * 1e6; // Convert to nanoseconds
}
