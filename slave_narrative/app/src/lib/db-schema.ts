import type Database from "better-sqlite3";

const SCHEMA_SQL = `
-- Core: narratives (deduplicated across collections)
CREATE TABLE IF NOT EXISTS narratives (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    author TEXT,
    pub_date_raw TEXT,
    pub_year INTEGER,
    pub_year_approximate INTEGER DEFAULT 0,
    pub_place TEXT,
    publisher TEXT,
    docsouth_url TEXT,
    collection TEXT NOT NULL,
    subjects TEXT DEFAULT '[]',
    word_count INTEGER,
    full_text TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_narratives_pub_year ON narratives(pub_year);

-- Track multi-collection membership
CREATE TABLE IF NOT EXISTS narrative_collections (
    narrative_id INTEGER NOT NULL REFERENCES narratives(id) ON DELETE CASCADE,
    collection TEXT NOT NULL,
    is_primary INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (narrative_id, collection)
);

-- Segments: paragraph-level text units
CREATE TABLE IF NOT EXISTS segments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    narrative_id INTEGER NOT NULL REFERENCES narratives(id) ON DELETE CASCADE,
    segment_index INTEGER NOT NULL,
    text TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'paragraph',
    chapter_heading TEXT,
    page_number TEXT,
    div_path TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_segments_narrative ON segments(narrative_id, segment_index);

-- FTS5 full-text search
CREATE VIRTUAL TABLE IF NOT EXISTS segments_fts USING fts5(
    text,
    chapter_heading,
    content='segments',
    content_rowid='id',
    tokenize='porter unicode61'
);

-- Entities (deferred to post-MVP)
CREATE TABLE IF NOT EXISTS entities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    canonical_name TEXT NOT NULL,
    type TEXT NOT NULL,
    surface_forms TEXT DEFAULT '[]',
    verified INTEGER DEFAULT 0,
    UNIQUE(canonical_name, type)
);

CREATE TABLE IF NOT EXISTS entity_mentions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_id INTEGER NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    segment_id INTEGER NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
    char_start INTEGER NOT NULL,
    char_end INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mentions_entity ON entity_mentions(entity_id);
CREATE INDEX IF NOT EXISTS idx_mentions_segment ON entity_mentions(segment_id);

-- Episodes
CREATE TABLE IF NOT EXISTS episodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    theme_tags TEXT DEFAULT '[]',
    content_warnings TEXT DEFAULT '[]',
    duration_minutes INTEGER DEFAULT 5,
    published INTEGER DEFAULT 0,
    beats TEXT NOT NULL DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
`;

const TRIGGERS_SQL = `
CREATE TRIGGER IF NOT EXISTS segments_ai AFTER INSERT ON segments BEGIN
    INSERT INTO segments_fts(rowid, text, chapter_heading) VALUES (new.id, new.text, new.chapter_heading);
END;

CREATE TRIGGER IF NOT EXISTS segments_ad AFTER DELETE ON segments BEGIN
    INSERT INTO segments_fts(segments_fts, rowid, text, chapter_heading) VALUES('delete', old.id, old.text, old.chapter_heading);
END;

CREATE TRIGGER IF NOT EXISTS segments_au AFTER UPDATE ON segments BEGIN
    INSERT INTO segments_fts(segments_fts, rowid, text, chapter_heading) VALUES('delete', old.id, old.text, old.chapter_heading);
    INSERT INTO segments_fts(rowid, text, chapter_heading) VALUES (new.id, new.text, new.chapter_heading);
END;

CREATE TRIGGER IF NOT EXISTS episodes_update_timestamp AFTER UPDATE ON episodes BEGIN
    UPDATE episodes SET updated_at = datetime('now') WHERE id = new.id;
END;
`;

export function initializeSchema(db: Database.Database): void {
  db.exec(SCHEMA_SQL);
  db.exec(TRIGGERS_SQL);
}

export function dropFtsTriggers(db: Database.Database): void {
  db.exec(`
    DROP TRIGGER IF EXISTS segments_ai;
    DROP TRIGGER IF EXISTS segments_ad;
    DROP TRIGGER IF EXISTS segments_au;
  `);
}

export function rebuildFtsIndex(db: Database.Database): void {
  db.exec(`INSERT INTO segments_fts(segments_fts) VALUES('rebuild')`);
}

export function createFtsTriggers(db: Database.Database): void {
  db.exec(TRIGGERS_SQL);
}
