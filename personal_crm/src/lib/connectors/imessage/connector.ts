import Database from "better-sqlite3";
import { existsSync } from "fs";
import { homedir } from "os";
import { join, resolve } from "path";

import { Result, ok, err, tryCatchSync } from "@/lib/result";
import { BaseConnector } from "../base-connector";
import {
  ConnectorConfig,
  ConnectorEvents,
  HealthCheckResult,
  RawMessage,
  RawContact,
} from "../types";
import { registerConnector } from "../registry";
import {
  GET_MESSAGES_SINCE_QUERY,
  GET_HANDLES_QUERY,
  COUNT_MESSAGES_QUERY,
  GET_LATEST_MESSAGE_DATE_QUERY,
  dateToMacAbsoluteTime,
} from "./queries";
import {
  IMessageRow,
  IHandleRow,
  parseMessageRow,
  parseHandleRow,
} from "./parser";

/**
 * Default path to iMessage database on macOS
 */
const DEFAULT_IMESSAGE_DB_PATH = join(
  homedir(),
  "Library",
  "Messages",
  "chat.db"
);

/**
 * Allowlist of valid database paths to prevent path traversal attacks
 */
const ALLOWED_PATHS = [
  join(homedir(), "Library", "Messages", "chat.db"),
];

/**
 * iMessage connector for reading from the local chat.db SQLite database.
 *
 * Requirements:
 * - macOS only
 * - Full Disk Access permission for the app
 * - Database is read-only (we never write to it)
 */
export class IMessageConnector extends BaseConnector {
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor(config: ConnectorConfig, events?: ConnectorEvents) {
    super(config, events);
    const requestedPath =
      (config.config.dbPath as string) || DEFAULT_IMESSAGE_DB_PATH;
    const resolvedPath = resolve(requestedPath);

    if (!ALLOWED_PATHS.includes(resolvedPath)) {
      throw new Error(`Invalid database path: ${requestedPath}`);
    }
    this.dbPath = resolvedPath;
  }

  /**
   * Initialize the connector - check database exists and is accessible
   */
  async init(): Promise<Result<void>> {
    this.setState("initializing");

    // Check if database file exists
    if (!existsSync(this.dbPath)) {
      this.setState("error");
      return err(
        new Error(
          `iMessage database not found at ${this.dbPath}. ` +
            "Make sure you're on macOS and the path is correct."
        )
      );
    }

    // Try to open the database
    const openResult = tryCatchSync(() => {
      this.db = new Database(this.dbPath, { readonly: true });
      // Test query to verify access
      this.db.prepare("SELECT 1").get();
    });

    if (!openResult.ok) {
      this.setState("error");
      return err(
        new Error(
          `Cannot access iMessage database. ` +
            "Please grant Full Disk Access to this app in " +
            "System Preferences > Security & Privacy > Privacy > Full Disk Access. " +
            `Original error: ${openResult.error.message}`
        )
      );
    }

    this.setState("ready");
    return ok(undefined);
  }

  /**
   * Shutdown the connector and close database connection
   */
  async shutdown(): Promise<Result<void>> {
    if (this.db) {
      const closeResult = tryCatchSync(() => {
        this.db?.close();
        this.db = null;
      });

      if (!closeResult.ok) {
        return err(closeResult.error);
      }
    }

    this.setState("shutdown");
    return ok(undefined);
  }

  /**
   * Check health of the connector
   */
  async healthCheck(): Promise<Result<HealthCheckResult>> {
    if (!this.db) {
      return ok({
        ok: false,
        error: "Connector not initialized",
      });
    }

    const healthResult = tryCatchSync(() => {
      // Count total messages
      const countRow = this.db!.prepare(COUNT_MESSAGES_QUERY).get() as {
        count: number;
      };

      // Get latest message date
      const latestRow = this.db!.prepare(GET_LATEST_MESSAGE_DATE_QUERY).get() as {
        latest_date: number | null;
      };

      return {
        ok: true,
        recordCount: countRow.count,
        lastSync: latestRow.latest_date
          ? new Date(latestRow.latest_date)
          : undefined,
      };
    });

    if (!healthResult.ok) {
      return ok({
        ok: false,
        error: healthResult.error.message,
      });
    }

    return ok(healthResult.value);
  }

  /**
   * Fetch messages from iMessage database
   * Uses iterate() for O(1) memory usage - streams rows instead of loading all at once
   */
  async *fetchMessages(since?: Date): AsyncGenerator<RawMessage> {
    if (!this.db) {
      throw new Error("Connector not initialized");
    }

    this.setState("syncing");

    const sinceTime = since ? dateToMacAbsoluteTime(since) : 0;

    const stmt = this.db.prepare(GET_MESSAGES_SINCE_QUERY);

    let count = 0;

    // Stream rows one at a time instead of loading all into memory
    for (const row of stmt.iterate(sinceTime)) {
      const message = parseMessageRow(row as IMessageRow);
      if (message) {
        yield message;
        count++;
        // Progress without total - emits count only
        this.emitProgress(count);
      }
    }

    this.setState("ready");
  }

  /**
   * Fetch contacts from iMessage database
   * Uses iterate() for O(1) memory usage - streams rows instead of loading all at once
   */
  async *fetchContacts(): AsyncGenerator<RawContact> {
    if (!this.db) {
      throw new Error("Connector not initialized");
    }

    this.setState("syncing");

    const stmt = this.db.prepare(GET_HANDLES_QUERY);

    let count = 0;

    // Stream rows one at a time instead of loading all into memory
    for (const row of stmt.iterate()) {
      const contact = parseHandleRow(row as IHandleRow);
      yield contact;
      count++;
      // Progress without total - emits count only
      this.emitProgress(count);
    }

    this.setState("ready");
  }
}

// Register the connector with the registry
registerConnector("imessage", (config, events) => {
  return new IMessageConnector(config, events);
});
