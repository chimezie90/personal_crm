import { db } from "../db";
import type { NarrativeRow, Narrative } from "../db-types";
import { parseNarrativeRow } from "../db-types";

/** List row type — only the columns we actually SELECT */
interface NarrativeListRow {
  id: number;
  filename: string;
  title: string;
  author: string | null;
  pub_year: number | null;
  pub_year_approximate: number;
  collection: string;
  subjects: string;
  word_count: number | null;
  created_at: string;
}

export function listNarratives(): Omit<Narrative, "pub_date_raw" | "pub_place" | "publisher" | "docsouth_url" | "full_text">[] {
  const rows = db
    .prepare(
      `SELECT id, filename, title, author, pub_year, pub_year_approximate,
              collection, subjects, word_count, created_at
       FROM narratives ORDER BY title`
    )
    .all() as NarrativeListRow[];
  return rows.map((row) => ({
    ...row,
    subjects: JSON.parse(row.subjects) as string[],
    pub_year_approximate: row.pub_year_approximate === 1,
  }));
}

export function getNarrative(id: number): Narrative | undefined {
  const row = db
    .prepare(`SELECT * FROM narratives WHERE id = ?`)
    .get(id) as NarrativeRow | undefined;
  return row ? parseNarrativeRow(row) : undefined;
}

