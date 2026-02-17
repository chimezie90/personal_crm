import Database from "better-sqlite3";
import path from "node:path";

const DB_PATH = path.join(process.cwd(), "data", "narratives.db");

function createDatabase(): Database.Database {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.pragma("synchronous = NORMAL");
  db.pragma("cache_size = -64000");
  return db;
}

// Survive HMR in development
const globalForDb = globalThis as typeof globalThis & {
  __db?: Database.Database;
};

export const db: Database.Database = globalForDb.__db ?? createDatabase();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__db = db;
}
