import { db } from "../db";
import type { NarrativeRow, Narrative } from "../db-types";
import { parseNarrativeRow } from "../db-types";

export function listNarratives(): Narrative[] {
  const rows = db
    .prepare(
      `SELECT id, filename, title, author, pub_year, pub_year_approximate,
              collection, subjects, word_count, created_at
       FROM narratives ORDER BY title`
    )
    .all() as NarrativeRow[];
  return rows.map(parseNarrativeRow);
}

export function getNarrative(id: number): Narrative | undefined {
  const row = db
    .prepare(`SELECT * FROM narratives WHERE id = ?`)
    .get(id) as NarrativeRow | undefined;
  return row ? parseNarrativeRow(row) : undefined;
}

export function getNarrativeCount(): number {
  const row = db
    .prepare(`SELECT COUNT(*) as count FROM narratives`)
    .get() as { count: number };
  return row.count;
}
