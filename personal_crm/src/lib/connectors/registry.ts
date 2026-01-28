import { Result, ok, err } from "@/lib/result";
import { BaseConnector } from "./base-connector";
import { ConnectorConfig, DataSourceType, ConnectorEvents } from "./types";

/**
 * Factory function type for creating connectors
 */
type ConnectorFactory = (
  config: ConnectorConfig,
  events?: ConnectorEvents
) => BaseConnector;

/**
 * Registry of available connector factories
 */
const connectorFactories: Map<DataSourceType, ConnectorFactory> = new Map();

/**
 * Register a connector factory for a data source type
 */
export function registerConnector(
  type: DataSourceType,
  factory: ConnectorFactory
): void {
  connectorFactories.set(type, factory);
}

/**
 * Create a connector instance for the given configuration
 */
export function createConnector(
  config: ConnectorConfig,
  events?: ConnectorEvents
): Result<BaseConnector> {
  const factory = connectorFactories.get(config.type);

  if (!factory) {
    return err(
      new Error(
        `Unknown connector type: ${config.type}. Available types: ${Array.from(
          connectorFactories.keys()
        ).join(", ")}`
      )
    );
  }

  try {
    const connector = factory(config, events);
    return ok(connector);
  } catch (e) {
    return err(
      e instanceof Error
        ? e
        : new Error(`Failed to create ${config.type} connector`)
    );
  }
}

/**
 * Get list of registered connector types
 */
export function getRegisteredTypes(): DataSourceType[] {
  return Array.from(connectorFactories.keys());
}

/**
 * Check if a connector type is registered
 */
export function isTypeRegistered(type: DataSourceType): boolean {
  return connectorFactories.has(type);
}
