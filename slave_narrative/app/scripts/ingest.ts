#!/usr/bin/env npx tsx
/**
 * Usage: npx tsx scripts/ingest.ts ../source_data/na-slave-narratives
 */
import { ingest } from "../src/lib/ingest/ingest";

const sourceDir = process.argv[2];
if (!sourceDir) {
  console.error("Usage: npx tsx scripts/ingest.ts <source-data-collection-dir>");
  console.error("Example: npx tsx scripts/ingest.ts ../source_data/na-slave-narratives");
  process.exit(1);
}

ingest(sourceDir);
