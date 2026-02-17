import { z } from "zod";

// ---- Segment types ----

export const SEGMENT_TYPES = [
  "paragraph",
  "heading",
  "chapter_heading",
  "verse",
  "quote",
] as const;
export type SegmentType = (typeof SEGMENT_TYPES)[number];

// ---- Humanity lenses ----

export const HUMANITY_LENSES = [
  "family",
  "joy",
  "resistance",
  "education",
  "community",
  "faith",
  "craft",
  "love",
  "humor",
  "agency",
] as const;
export type HumanityLens = (typeof HUMANITY_LENSES)[number];

// ---- Beat schema ----

export const SegmentRangeSchema = z.object({
  start_index: z.number(),
  end_index: z.number(),
});

export const BeatSchema = z.object({
  id: z.string(),
  order: z.number(),
  segment_ids: z.array(z.number()),
  commentary: z.string().nullable().optional(),
  context_card: z
    .object({ title: z.string(), content: z.string() })
    .optional(),
  lens_tags: z.array(z.enum(HUMANITY_LENSES)).optional(),
  citation: z.object({
    narrative_id: z.number(),
    segment_range: SegmentRangeSchema,
    chapter: z.string().optional(),
    page: z.string().optional(),
  }),
});

export type Beat = z.infer<typeof BeatSchema>;
export type SegmentRange = z.infer<typeof SegmentRangeSchema>;

// ---- Raw DB Row Types (what better-sqlite3 returns) ----

export interface NarrativeRow {
  id: number;
  filename: string;
  title: string;
  author: string | null;
  pub_date_raw: string | null;
  pub_year: number | null;
  pub_year_approximate: number;
  pub_place: string | null;
  publisher: string | null;
  docsouth_url: string | null;
  collection: string;
  subjects: string;
  word_count: number | null;
  full_text: string;
  created_at: string;
}

export interface SegmentRow {
  id: number;
  narrative_id: number;
  segment_index: number;
  text: string;
  type: string;
  chapter_heading: string | null;
  page_number: string | null;
  div_path: string | null;
}

export interface EpisodeRow {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  theme_tags: string;
  content_warnings: string;
  duration_minutes: number;
  published: number;
  beats: string;
  created_at: string;
  updated_at: string;
}

// ---- Domain Types ----

export interface Narrative
  extends Omit<NarrativeRow, "subjects" | "pub_year_approximate"> {
  subjects: string[];
  pub_year_approximate: boolean;
}

export interface Segment extends Omit<SegmentRow, "type"> {
  type: SegmentType;
}

export interface Episode
  extends Omit<
    EpisodeRow,
    "theme_tags" | "content_warnings" | "beats" | "published"
  > {
  theme_tags: string[];
  content_warnings: string[];
  beats: Beat[];
  published: boolean;
}

// ---- Serialization boundary ----

const StringArraySchema = z.array(z.string());

export function parseNarrativeRow(row: NarrativeRow): Narrative {
  return {
    ...row,
    subjects: StringArraySchema.parse(JSON.parse(row.subjects)),
    pub_year_approximate: row.pub_year_approximate === 1,
  };
}

export function parseEpisodeRow(row: EpisodeRow): Episode {
  const rawBeats = JSON.parse(row.beats) as unknown[];
  const beats = rawBeats.map((b) => BeatSchema.parse(b));
  return {
    ...row,
    theme_tags: StringArraySchema.parse(JSON.parse(row.theme_tags)),
    content_warnings: StringArraySchema.parse(JSON.parse(row.content_warnings)),
    beats,
    published: row.published === 1,
  };
}

export function parseSegmentRow(row: SegmentRow): Segment {
  if (!SEGMENT_TYPES.includes(row.type as SegmentType)) {
    throw new Error(`Unknown segment type: ${row.type}`);
  }
  return row as Segment;
}
