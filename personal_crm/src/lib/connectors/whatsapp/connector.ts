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
import {
  parseWhatsAppExport,
  extractWhatsAppContacts,
  ParseOptions,
} from "./parser";

/**
 * WhatsApp connector for importing chat exports
 *
 * WhatsApp chats are exported as .txt files via:
 * Settings > Chats > Export Chat > Without Media
 *
 * The connector accepts file paths to these exports and parses them
 * to extract messages and contacts.
 */
export class WhatsAppConnector extends BaseConnector {
  private filePath: string | null = null;
  private chatName: string = "WhatsApp Chat";
  private parseOptions: ParseOptions = {};

  constructor(config: ConnectorConfig, events?: ConnectorEvents) {
    super(config, events);

    // Extract configuration
    if (config.config.filePath) {
      this.filePath = config.config.filePath as string;
    }
    if (config.config.chatName) {
      this.chatName = config.config.chatName as string;
    }
    if (config.config.userIdentifier) {
      this.parseOptions.userIdentifier = config.config.userIdentifier as string;
    }
    if (config.config.daysFirst !== undefined) {
      this.parseOptions.daysFirst = config.config.daysFirst as boolean;
    }
  }

  /**
   * Set the file path for import (can be set after construction)
   */
  setFilePath(filePath: string, chatName?: string): void {
    this.filePath = filePath;
    if (chatName) {
      this.chatName = chatName;
    }
  }

  /**
   * Set user identifier for direction detection
   */
  setUserIdentifier(identifier: string): void {
    this.parseOptions.userIdentifier = identifier;
  }

  /**
   * Initialize the connector
   * For file-based imports, this is essentially a no-op
   */
  async init(): Promise<Result<void>> {
    this.setState("initializing");

    // Validate file path if set
    if (this.filePath) {
      const { existsSync } = await import("fs");
      if (!existsSync(this.filePath)) {
        this.setState("error");
        return err(new Error(`WhatsApp export file not found: ${this.filePath}`));
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
   * Health check - verify file is accessible
   */
  async healthCheck(): Promise<Result<HealthCheckResult>> {
    if (!this.filePath) {
      return ok({
        ok: false,
        error: "No file path configured",
      });
    }

    const { existsSync, statSync } = await import("fs");
    if (!existsSync(this.filePath)) {
      return ok({
        ok: false,
        error: "Export file not found",
      });
    }

    const stats = statSync(this.filePath);
    return ok({
      ok: true,
      recordCount: undefined, // Unknown until parsed
      lastSync: stats.mtime,
    });
  }

  /**
   * Fetch messages from WhatsApp export
   */
  async *fetchMessages(since?: Date): AsyncGenerator<RawMessage> {
    if (!this.filePath) {
      throw new Error("No file path configured. Call setFilePath() first.");
    }

    this.setState("syncing");

    let count = 0;
    for await (const message of parseWhatsAppExport(
      this.filePath,
      this.chatName,
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
   * Fetch contacts from WhatsApp export
   */
  async *fetchContacts(): AsyncGenerator<RawContact> {
    if (!this.filePath) {
      throw new Error("No file path configured. Call setFilePath() first.");
    }

    this.setState("syncing");

    let count = 0;
    for await (const contact of extractWhatsAppContacts(
      this.filePath,
      this.chatName,
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
registerConnector("whatsapp", (config, events) => {
  return new WhatsAppConnector(config, events);
});
