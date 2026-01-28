// Re-export types
export * from "./types";

// Re-export base connector
export { BaseConnector, supportssCalls } from "./base-connector";

// Re-export registry functions
export {
  registerConnector,
  createConnector,
  getRegisteredTypes,
  isTypeRegistered,
} from "./registry";

// Import connectors to register them
import "./imessage/connector";
