#!/usr/bin/env npx tsx
/**
 * Seeds 3 demo episodes into the database.
 * Run after ingest: npx tsx scripts/seed-episodes.ts
 */
import Database from "better-sqlite3";
import path from "node:path";

const DB_PATH = path.join(process.cwd(), "data", "narratives.db");
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const insert = db.prepare(`
  INSERT OR REPLACE INTO episodes (slug, title, description, theme_tags, content_warnings, duration_minutes, published, beats)
  VALUES (@slug, @title, @description, @themeTags, @contentWarnings, @durationMinutes, @published, @beats)
`);

// Helper to get segment IDs by narrative_id + segment_index range
function getSegmentIds(narrativeId: number, startIdx: number, endIdx: number): number[] {
  const rows = db
    .prepare(
      `SELECT id FROM segments WHERE narrative_id = ? AND segment_index >= ? AND segment_index <= ? ORDER BY segment_index`
    )
    .all(narrativeId, startIdx, endIdx) as { id: number }[];
  return rows.map((r) => r.id);
}

// ===== Episode 1: Learning to Read (Douglass) =====
const ep1Beats = [
  {
    id: "douglass-read-1",
    order: 0,
    segment_ids: getSegmentIds(95, 65, 65),
    commentary: null,
    context_card: {
      title: "Mrs. Auld",
      content:
        "Sophia Auld was the wife of Hugh Auld, to whom Douglass was sent to live in Baltimore around age 7-8. She had never owned a slave before and initially treated him with kindness.",
    },
    lens_tags: ["education"],
    citation: { narrative_id: 95, segment_range: { start_index: 65, end_index: 65 } },
  },
  {
    id: "douglass-read-2",
    order: 1,
    segment_ids: getSegmentIds(95, 69, 69),
    commentary:
      "Note how Douglass directly connects literacy with liberation — Mr. Auld understood that reading would make Douglass \"unfit\" for slavery. This inadvertently gave Douglass the key insight of his life.",
    lens_tags: ["education", "resistance"],
    citation: { narrative_id: 95, segment_range: { start_index: 69, end_index: 69 } },
  },
  {
    id: "douglass-read-3",
    order: 2,
    segment_ids: getSegmentIds(95, 68, 68),
    commentary:
      "Without a formal teacher, Douglass devised his own methods — befriending white boys in the street, carrying bread to trade for reading lessons. His resourcefulness was extraordinary.",
    lens_tags: ["education", "agency", "craft"],
    citation: { narrative_id: 95, segment_range: { start_index: 68, end_index: 68 } },
  },
  {
    id: "douglass-read-4",
    order: 3,
    segment_ids: getSegmentIds(95, 75, 75),
    commentary:
      "Douglass learned to write by studying letters marked on ship timbers and challenging boys to handwriting contests. Each skill was won through ingenuity.",
    lens_tags: ["education", "craft", "agency"],
    citation: { narrative_id: 95, segment_range: { start_index: 75, end_index: 75 } },
  },
];

// ===== Episode 2: A Grandmother's Love (Jacobs) =====
const ep2Beats = [
  {
    id: "jacobs-gma-1",
    order: 0,
    segment_ids: getSegmentIds(13, 3, 3),
    context_card: {
      title: "Harriet Jacobs",
      content:
        "Harriet Ann Jacobs (1813-1897) wrote under the pseudonym 'Linda Brent.' Her father was a skilled carpenter owned by a different master. Her narrative is one of the most important accounts of slavery written by a woman.",
    },
    lens_tags: ["family", "craft"],
    citation: { narrative_id: 13, segment_range: { start_index: 3, end_index: 3 } },
  },
  {
    id: "jacobs-gma-2",
    order: 1,
    segment_ids: getSegmentIds(13, 4, 4),
    commentary:
      "The grandmother's baking was both an act of love and entrepreneurship. Her crackers and preserves were famous in the community and helped her save money toward purchasing her family's freedom.",
    lens_tags: ["family", "craft", "love"],
    citation: { narrative_id: 13, segment_range: { start_index: 4, end_index: 4 } },
  },
  {
    id: "jacobs-gma-3",
    order: 2,
    segment_ids: getSegmentIds(13, 5, 5),
    commentary:
      "The death of a kind mistress and the uncertainty it brought reveals how enslaved people lived under constant precarity — even \"good\" circumstances could vanish overnight.",
    lens_tags: ["family"],
    citation: { narrative_id: 13, segment_range: { start_index: 5, end_index: 5 } },
  },
  {
    id: "jacobs-gma-4",
    order: 3,
    segment_ids: getSegmentIds(13, 22, 22),
    commentary:
      "The grandmother lent her own hard-earned savings — $300, a vast sum — only to be defrauded. Despite this betrayal, she continued working to support her grandchildren. Her resilience anchored the entire family.",
    lens_tags: ["family", "resistance", "agency"],
    citation: { narrative_id: 13, segment_range: { start_index: 22, end_index: 22 } },
  },
  {
    id: "jacobs-gma-5",
    order: 4,
    segment_ids: getSegmentIds(13, 25, 25),
    commentary: null,
    lens_tags: ["family", "resistance"],
    citation: { narrative_id: 13, segment_range: { start_index: 25, end_index: 25 } },
  },
];

// ===== Episode 3: The Turning Point (Douglass vs Covey) =====
const ep3Beats = [
  {
    id: "douglass-covey-1",
    order: 0,
    segment_ids: getSegmentIds(95, 101, 101),
    context_card: {
      title: "Edward Covey",
      content:
        "Covey was a poor farmer known as a 'slave-breaker.' Slaveholders sent difficult slaves to him for a year. Douglass was 16 when sent to Covey, who worked and beat him relentlessly.",
    },
    lens_tags: ["resistance"],
    citation: { narrative_id: 95, segment_range: { start_index: 101, end_index: 101 } },
  },
  {
    id: "douglass-covey-2",
    order: 1,
    segment_ids: getSegmentIds(95, 103, 103),
    commentary:
      "This passage — Douglass speaking to ships on the Chesapeake Bay — is one of the most powerful moments in American literature. He addresses the ships as free beings, contrasting their liberty with his bondage.",
    lens_tags: ["resistance", "agency"],
    citation: { narrative_id: 95, segment_range: { start_index: 103, end_index: 103 } },
  },
  {
    id: "douglass-covey-3",
    order: 2,
    segment_ids: getSegmentIds(95, 107, 107),
    commentary:
      "The fight with Covey was the pivotal moment. After being beaten for six months, Douglass fought back. Covey never beat him again. This was not just physical resistance — it was the reclamation of his humanity.",
    lens_tags: ["resistance", "agency"],
    citation: { narrative_id: 95, segment_range: { start_index: 107, end_index: 107 } },
  },
];

// Insert all episodes
const seedAll = db.transaction(() => {
  insert.run({
    slug: "learning-to-read",
    title: "Learning to Read",
    description:
      "How Frederick Douglass taught himself to read and write — and why slaveholders feared literacy above all else.",
    themeTags: JSON.stringify(["education", "agency", "craft"]),
    contentWarnings: JSON.stringify(["references to physical punishment", "dehumanizing language of the era"]),
    durationMinutes: 5,
    published: 1,
    beats: JSON.stringify(ep1Beats),
  });

  insert.run({
    slug: "a-grandmothers-love",
    title: "A Grandmother's Love",
    description:
      "Harriet Jacobs' grandmother — baker, entrepreneur, and the unbreakable heart of a family torn apart by slavery.",
    themeTags: JSON.stringify(["family", "love", "craft", "resistance"]),
    contentWarnings: JSON.stringify(["descriptions of family separation", "financial exploitation"]),
    durationMinutes: 5,
    published: 1,
    beats: JSON.stringify(ep2Beats),
  });

  insert.run({
    slug: "the-turning-point",
    title: "The Turning Point",
    description:
      "The moment Frederick Douglass fought back — and reclaimed his sense of self.",
    themeTags: JSON.stringify(["resistance", "agency"]),
    contentWarnings: JSON.stringify(["descriptions of physical violence", "dehumanizing conditions"]),
    durationMinutes: 4,
    published: 1,
    beats: JSON.stringify(ep3Beats),
  });
});

seedAll();
console.log("Seeded 3 episodes.");

// Verify
const count = (db.prepare("SELECT COUNT(*) as c FROM episodes").get() as { c: number }).c;
console.log(`Total episodes in DB: ${count}`);

db.close();
