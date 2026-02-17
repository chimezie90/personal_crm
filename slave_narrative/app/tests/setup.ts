import Database from "better-sqlite3";
import { initializeSchema } from "../src/lib/db-schema";

/**
 * Create an in-memory database for testing.
 * Call in beforeEach to get a fresh DB per test.
 */
export function createTestDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  initializeSchema(db);
  return db;
}
