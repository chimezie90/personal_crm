import { db } from "../db";
import type { SegmentRow, Segment } from "../db-types";
import { parseSegmentRow } from "../db-types";

export function getSegmentsByNarrative(narrativeId: number): Segment[] {
  const rows = db
    .prepare(
      `SELECT * FROM segments WHERE narrative_id = ? ORDER BY segment_index`
    )
    .all(narrativeId) as SegmentRow[];
  return rows.map(parseSegmentRow);
}

export function getSegmentsByIds(ids: number[]): Segment[] {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT * FROM segments WHERE id IN (${placeholders}) ORDER BY narrative_id, segment_index`
    )
    .all(...ids) as SegmentRow[];
  return rows.map(parseSegmentRow);
}

/** Sanitize FTS5 queries: strip operators and quote each token */
function sanitizeFtsQuery(raw: string): string {
  const stripped = raw.replace(/[^\p{L}\p{N}\s]/gu, "").trim();
  if (!stripped) return "";
  // Quote each token to prevent implicit boolean operators (AND, OR, NOT)
  return stripped
    .split(/\s+/)
    .map((t) => `"${t}"`)
    .join(" ");
}

export function searchSegments(
  query: string,
  limit = 20,
  offset = 0
): { segments: Segment[]; total: number } {
  const sanitized = sanitizeFtsQuery(query);
  if (!sanitized) return { segments: [], total: 0 };

  const countRow = db
    .prepare(
      `SELECT COUNT(*) as count FROM segments_fts WHERE segments_fts MATCH ?`
    )
    .get(sanitized) as { count: number };

  const rows = db
    .prepare(
      `SELECT s.* FROM segments s
       JOIN segments_fts fts ON fts.rowid = s.id
       WHERE segments_fts MATCH ?
       ORDER BY rank
       LIMIT ? OFFSET ?`
    )
    .all(sanitized, limit, offset) as SegmentRow[];

  return { segments: rows.map(parseSegmentRow), total: countRow.count };
}
