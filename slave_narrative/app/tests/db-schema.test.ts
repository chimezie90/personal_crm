import { describe, it, expect } from "vitest";
import { createTestDb } from "./setup";

describe("db-schema", () => {
  it("creates all tables", () => {
    const db = createTestDb();
    const tables = db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
      )
      .all() as { name: string }[];
    const names = tables.map((t) => t.name).sort();
    expect(names).toContain("narratives");
    expect(names).toContain("segments");
    expect(names).toContain("entities");
    expect(names).toContain("entity_mentions");
    expect(names).toContain("episodes");
    expect(names).toContain("narrative_collections");
    db.close();
  });

  it("inserts a narrative and segments", () => {
    const db = createTestDb();
    db.prepare(
      `INSERT INTO narratives (filename, title, collection, full_text)
       VALUES ('test.xml', 'Test Narrative', 'neh', 'Full text here')`
    ).run();

    db.prepare(
      `INSERT INTO segments (narrative_id, segment_index, text, type)
       VALUES (1, 0, 'First paragraph', 'paragraph')`
    ).run();

    const seg = db
      .prepare(`SELECT * FROM segments WHERE narrative_id = 1`)
      .get() as { text: string };
    expect(seg.text).toBe("First paragraph");
    db.close();
  });

  it("enforces unique segment index per narrative", () => {
    const db = createTestDb();
    db.prepare(
      `INSERT INTO narratives (filename, title, collection, full_text)
       VALUES ('test.xml', 'Test', 'neh', 'text')`
    ).run();
    db.prepare(
      `INSERT INTO segments (narrative_id, segment_index, text, type)
       VALUES (1, 0, 'First', 'paragraph')`
    ).run();
    expect(() =>
      db
        .prepare(
          `INSERT INTO segments (narrative_id, segment_index, text, type)
         VALUES (1, 0, 'Duplicate', 'paragraph')`
        )
        .run()
    ).toThrow();
    db.close();
  });

  it("populates FTS index via triggers", () => {
    const db = createTestDb();
    db.prepare(
      `INSERT INTO narratives (filename, title, collection, full_text)
       VALUES ('test.xml', 'Test', 'neh', 'text')`
    ).run();
    db.prepare(
      `INSERT INTO segments (narrative_id, segment_index, text, type)
       VALUES (1, 0, 'freedom liberty justice', 'paragraph')`
    ).run();

    const result = db
      .prepare(
        `SELECT rowid FROM segments_fts WHERE segments_fts MATCH 'liberty'`
      )
      .all();
    expect(result.length).toBe(1);
    db.close();
  });
});
