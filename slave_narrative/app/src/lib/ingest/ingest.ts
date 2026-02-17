import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { initializeSchema, dropFtsTriggers, rebuildFtsIndex, createFtsTriggers } from "../db-schema";
import { parseTeiXml, type ParsedNarrative } from "./parse-tei";

const DB_PATH = path.join(process.cwd(), "data", "narratives.db");

export function ingest(sourceDir: string): void {
  const xmlDir = path.join(sourceDir, "data", "xml");
  if (!fs.existsSync(xmlDir)) {
    console.error(`XML directory not found: ${xmlDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(xmlDir).filter((f) => f.endsWith(".xml"));
  console.log(`Found ${files.length} XML files in ${xmlDir}`);

  // Ensure data dir
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Remove old DB for clean ingest
  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
    // Also clean WAL files
    for (const ext of ["-wal", "-shm"]) {
      const walPath = DB_PATH + ext;
      if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    }
  }

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("synchronous = OFF"); // Faster for bulk import
  db.pragma("cache_size = -64000");

  initializeSchema(db);
  dropFtsTriggers(db); // Disable triggers during bulk insert

  const insertNarrative = db.prepare(`
    INSERT INTO narratives (filename, title, author, pub_date_raw, pub_year, pub_year_approximate,
      pub_place, publisher, docsouth_url, collection, subjects, word_count, full_text)
    VALUES (@filename, @title, @author, @pubDateRaw, @pubYear, @pubYearApproximate,
      @pubPlace, @publisher, @docsouthUrl, @collection, @subjects, @wordCount, @fullText)
  `);

  const insertSegment = db.prepare(`
    INSERT INTO segments (narrative_id, segment_index, text, type, chapter_heading, page_number, div_path)
    VALUES (@narrativeId, @segmentIndex, @text, @type, @chapterHeading, @pageNumber, @divPath)
  `);

  // Determine collection from directory name
  const collectionName = path.basename(sourceDir);

  let successCount = 0;
  let errorCount = 0;
  let totalSegments = 0;

  const bulkInsert = db.transaction((narratives: ParsedNarrative[]) => {
    for (const n of narratives) {
      const wordCount = n.fullText.split(/\s+/).length;
      const docsouthUrl = `https://docsouth.unc.edu/neh/${n.filename.replace(/^neh-/, "").replace(/\.xml$/, "")}/`;

      const result = insertNarrative.run({
        filename: n.filename,
        title: n.title,
        author: n.author,
        pubDateRaw: n.pubDateRaw,
        pubYear: n.pubYear,
        pubYearApproximate: n.pubYearApproximate ? 1 : 0,
        pubPlace: n.pubPlace,
        publisher: n.publisher,
        docsouthUrl: docsouthUrl,
        collection: collectionName,
        subjects: JSON.stringify(n.subjects),
        wordCount: wordCount,
        fullText: n.fullText,
      });

      const narrativeId = result.lastInsertRowid;

      for (const seg of n.segments) {
        insertSegment.run({
          narrativeId,
          segmentIndex: seg.index,
          text: seg.text,
          type: seg.type,
          chapterHeading: seg.chapterHeading,
          pageNumber: seg.pageNumber,
          divPath: seg.divPath,
        });
      }

      totalSegments += n.segments.length;
    }
  });

  // Parse all files
  const parsed: ParsedNarrative[] = [];
  for (const file of files) {
    try {
      const xmlPath = path.join(xmlDir, file);
      const xml = fs.readFileSync(xmlPath, "utf-8");
      const narrative = parseTeiXml(xml, file);

      if (narrative.segments.length === 0) {
        console.warn(`  SKIP (no segments): ${file}`);
        errorCount++;
        continue;
      }

      parsed.push(narrative);
      successCount++;

      if (successCount % 50 === 0) {
        console.log(`  Parsed ${successCount}/${files.length}...`);
      }
    } catch (err) {
      console.error(`  ERROR: ${file}: ${err}`);
      errorCount++;
    }
  }

  // Bulk insert in single transaction
  console.log(`\nInserting ${parsed.length} narratives...`);
  bulkInsert(parsed);

  // Rebuild FTS index
  console.log("Building FTS index...");
  rebuildFtsIndex(db);
  createFtsTriggers(db);

  // Reset to normal sync
  db.pragma("synchronous = NORMAL");

  console.log(`\nDone!`);
  console.log(`  Narratives: ${successCount} ingested, ${errorCount} errors`);
  console.log(`  Segments: ${totalSegments}`);
  console.log(`  DB: ${DB_PATH}`);

  db.close();
}
