import { Result } from "@/lib/result";

export type DataSourceType =
  | "imessage"
  | "whatsapp"
  | "facebook"
  | "email"
  | "phone";

export interface ConnectorConfig {
  id: string;
  name: string;
  type: DataSourceType;
  enabled: boolean;
  pollIntervalMs: number;
  config: Record<string, unknown>;
}

export interface RawMessage {
  sourceId: string;
  content: string | null;
  timestamp: Date;
  direction: "inbound" | "outbound";
  senderIdentifier: string;
  type: "message" | "call" | "email";
  durationSeconds?: number;
  metadata?: Record<string, unknown>;
}

export interface RawContact {
  identifier: string;
  displayName?: string;
  photoUrl?: string;
  source: DataSourceType;
}

export interface HealthCheckResult {
  ok: boolean;
  lastSync?: Date;
  recordCount?: number;
  error?: string;
}

/**
 * Capability interface for connectors that provide messages
 */
export interface MessageProvider {
  fetchMessages(since?: Date): AsyncGenerator<RawMessage>;
}

/**
 * Capability interface for connectors that provide contacts
 */
export interface ContactProvider {
  fetchContacts(): AsyncGenerator<RawContact>;
}

/**
 * Capability interface for connectors that provide call history
 */
export interface CallProvider {
  fetchCalls(since?: Date): AsyncGenerator<RawMessage>;
}

/**
 * Lifecycle states for a connector
 */
export type ConnectorState =
  | "uninitialized"
  | "initializing"
  | "ready"
  | "syncing"
  | "paused"
  | "error"
  | "shutdown";

/**
 * Events emitted by connectors
 */
export interface ConnectorEvents {
  onStateChange?: (state: ConnectorState) => void;
  onError?: (error: Error) => void;
  onProgress?: (current: number, total: number) => void;
}
