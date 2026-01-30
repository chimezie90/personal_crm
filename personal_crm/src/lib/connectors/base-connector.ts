import { Result, ok, err } from "@/lib/result";
import {
  ConnectorConfig,
  ConnectorState,
  ConnectorEvents,
  HealthCheckResult,
  RawMessage,
  RawContact,
  MessageProvider,
  ContactProvider,
} from "./types";

/**
 * Base class for all data source connectors.
 * Implements the connector lifecycle and provides common functionality.
 */
export abstract class BaseConnector implements MessageProvider, ContactProvider {
  protected config: ConnectorConfig;
  protected state: ConnectorState = "uninitialized";
  protected events: ConnectorEvents;

  constructor(config: ConnectorConfig, events: ConnectorEvents = {}) {
    this.config = config;
    this.events = events;
  }

  /**
   * Get current connector state
   */
  getState(): ConnectorState {
    return this.state;
  }

  /**
   * Get connector configuration
   */
  getConfig(): ConnectorConfig {
    return { ...this.config };
  }

  /**
   * Update connector state and emit event
   */
  protected setState(newState: ConnectorState): void {
    this.state = newState;
    this.events.onStateChange?.(newState);
  }

  /**
   * Emit error event
   */
  protected emitError(error: Error): void {
    this.events.onError?.(error);
  }

  /**
   * Emit progress event
   * @param current - Current count of processed items
   * @param total - Optional total count (may be unknown when streaming)
   */
  protected emitProgress(current: number, total?: number): void {
    this.events.onProgress?.(current, total ?? current);
  }

  /**
   * Initialize the connector (check permissions, validate config, etc.)
   */
  abstract init(): Promise<Result<void>>;

  /**
   * Clean up resources and shutdown
   */
  abstract shutdown(): Promise<Result<void>>;

  /**
   * Check connector health (can access data source, permissions valid, etc.)
   */
  abstract healthCheck(): Promise<Result<HealthCheckResult>>;

  /**
   * Fetch messages since a given date (or all if not provided)
   */
  abstract fetchMessages(since?: Date): AsyncGenerator<RawMessage>;

  /**
   * Fetch all contacts from this source
   */
  abstract fetchContacts(): AsyncGenerator<RawContact>;
}
