import { db } from "../db";
import type { EpisodeRow, Episode } from "../db-types";
import { parseEpisodeRow } from "../db-types";

export function listPublishedEpisodes(): Episode[] {
  const rows = db
    .prepare(
      `SELECT * FROM episodes WHERE published = 1 ORDER BY created_at DESC`
    )
    .all() as EpisodeRow[];
  return rows.map(parseEpisodeRow);
}

export function getEpisodeBySlug(slug: string): Episode | undefined {
  const row = db
    .prepare(`SELECT * FROM episodes WHERE slug = ?`)
    .get(slug) as EpisodeRow | undefined;
  return row ? parseEpisodeRow(row) : undefined;
}

