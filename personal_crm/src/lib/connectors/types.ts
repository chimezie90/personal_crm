import { Result } from "@/lib/result";

const DATA_SOURCE_TYPES = ["imessage", "whatsapp", "facebook", "instagram", "email", "phone"] as const;

export type DataSourceType = (typeof DATA_SOURCE_TYPES)[number];

export function isDataSourceType(s: string): s is DataSourceType {
  return DATA_SOURCE_TYPES.includes(s as DataSourceType);
}

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
