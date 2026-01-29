import { Result, ok, err } from "@/lib/result";
import { BaseConnector } from "../base-connector";
import {
  ConnectorConfig,
  ConnectorEvents,
  HealthCheckResult,
  RawMessage,
  RawContact,
} from "../types";
import { registerConnector } from "../registry";
import { parseFacebookExport, extractFacebookContacts, ParseOptions } from "./parser";

/**
 * Facebook Messenger connector for importing message exports
 *
 * Facebook messages are exported via:
 * Settings > Your Facebook Information > Download Your Information
 * Select: Messages, Format: JSON
 *
 * The export contains a messages/inbox/ directory with conversation folders.
 */
export class FacebookConnector extends BaseConnector {
  private exportPath: string | null = null;
  private parseOptions: ParseOptions = {};

  constructor(config: ConnectorConfig, events?: ConnectorEvents) {
    super(config, events);

    // Extract configuration
    if (config.config.exportPath) {
      this.exportPath = config.config.exportPath as string;
    }
    if (config.config.userName) {
      this.parseOptions.userName = config.config.userName as string;
    }
  }

  /**
   * Set the export path for import (can be set after construction)
   */
  setExportPath(exportPath: string): void {
    this.exportPath = exportPath;
  }

  /**
   * Set user name for direction detection
   */
  setUserName(userName: string): void {
    this.parseOptions.userName = userName;
  }

  /**
   * Initialize the connector
   */
  async init(): Promise<Result<void>> {
    this.setState("initializing");

    // Validate export path if set
    if (this.exportPath) {
      const { existsSync } = await import("fs");
      if (!existsSync(this.exportPath)) {
        this.setState("error");
        return err(
          new Error(`Facebook export directory not found: ${this.exportPath}`)
        );
      }
    }

    this.setState("ready");
    return ok(undefined);
  }

  /**
   * Shutdown the connector
   */
  async shutdown(): Promise<Result<void>> {
    this.setState("shutdown");
    return ok(undefined);
  }

  /**
   * Health check - verify export directory is accessible
   */
  async healthCheck(): Promise<Result<HealthCheckResult>> {
    if (!this.exportPath) {
      return ok({
        ok: false,
        error: "No export path configured",
      });
    }

    const { existsSync, statSync } = await import("fs");
    if (!existsSync(this.exportPath)) {
      return ok({
        ok: false,
        error: "Export directory not found",
      });
    }

    const stats = statSync(this.exportPath);
    return ok({
      ok: true,
      recordCount: undefined, // Unknown until parsed
      lastSync: stats.mtime,
    });
  }

  /**
   * Fetch messages from Facebook export
   */
  async *fetchMessages(since?: Date): AsyncGenerator<RawMessage> {
    if (!this.exportPath) {
      throw new Error("No export path configured. Call setExportPath() first.");
    }

    this.setState("syncing");

    let count = 0;
    for await (const message of parseFacebookExport(
      this.exportPath,
      this.parseOptions
    )) {
      // Filter by date if since is provided
      if (since && message.timestamp < since) {
        continue;
      }

      yield message;
      count++;
      this.emitProgress(count);
    }

    this.setState("ready");
  }

  /**
   * Fetch contacts from Facebook export
   */
  async *fetchContacts(): AsyncGenerator<RawContact> {
    if (!this.exportPath) {
      throw new Error("No export path configured. Call setExportPath() first.");
    }

    this.setState("syncing");

    let count = 0;
    for await (const contact of extractFacebookContacts(
      this.exportPath,
      this.parseOptions
    )) {
      yield contact;
      count++;
      this.emitProgress(count);
    }

    this.setState("ready");
  }
}

// Register the connector with the registry
registerConnector("facebook", (config, events) => {
  return new FacebookConnector(config, events);
});
