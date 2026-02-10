import { z } from "zod";

export const messageSourceSchema = z.enum([
  "imessage",
  "whatsapp",
  "facebook",
  "instagram",
  "email",
  "phone",
]);

export type MessageSource = z.infer<typeof messageSourceSchema>;

export const messageTypeSchema = z.enum(["message", "call", "email"]);

export type MessageType = z.infer<typeof messageTypeSchema>;

export const directionSchema = z.enum(["inbound", "outbound"]);

export type Direction = z.infer<typeof directionSchema>;

export const sentimentLabelSchema = z.enum(["positive", "negative", "neutral"]);

export type SentimentLabel = z.infer<typeof sentimentLabelSchema>;

export const messageSchema = z.object({
  id: z.string(),
  contactId: z.string(),
  source: messageSourceSchema,
  type: messageTypeSchema,
  sourceMessageId: z.string().nullable(),
  content: z.string().nullable(),
  direction: directionSchema,
  durationSeconds: z.number().nullable(),
  sentimentScore: z.number().min(-1).max(1).nullable(),
  sentimentLabel: sentimentLabelSchema.nullable(),
  timestamp: z.date(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.date(),
});

export type Message = z.infer<typeof messageSchema>;

/**
 * Parse metadata JSON string from database
 */
export function parseMetadata(json: string): Record<string, unknown> {
  try {
    return JSON.parse(json);
  } catch (error) {
    console.warn(`[parseMetadata] Failed to parse JSON: ${json.slice(0, 100)}...`, error);
    return {};
  }
}

/**
 * Convert database row to Message type
 */
export function dbRowToMessage(row: {
  id: string;
  contactId: string;
  source: string;
  type: string;
  sourceMessageId: string | null;
  content: string | null;
  direction: string;
  durationSeconds: number | null;
  sentimentScore: number | null;
  sentimentLabel: string | null;
  timestamp: Date;
  metadata: string;
  createdAt: Date;
}): Message {
  return {
    id: row.id,
    contactId: row.contactId,
    source: messageSourceSchema.parse(row.source),
    type: messageTypeSchema.parse(row.type),
    sourceMessageId: row.sourceMessageId,
    content: row.content,
    direction: directionSchema.parse(row.direction),
    durationSeconds: row.durationSeconds,
    sentimentScore: row.sentimentScore,
    sentimentLabel: row.sentimentLabel
      ? sentimentLabelSchema.parse(row.sentimentLabel)
      : null,
    timestamp: row.timestamp,
    metadata: parseMetadata(row.metadata),
    createdAt: row.createdAt,
  };
}

/**
 * Get display icon for message source
 */
export function getSourceIcon(source: MessageSource): string {
  const icons: Record<MessageSource, string> = {
    imessage: "💬",
    whatsapp: "📱",
    facebook: "👤",
    instagram: "📷",
    email: "✉️",
    phone: "📞",
  };
  return icons[source];
}

/**
 * Get display label for message source
 */
export function getSourceLabel(source: MessageSource): string {
  const labels: Record<MessageSource, string> = {
    imessage: "iMessage",
    whatsapp: "WhatsApp",
    facebook: "Facebook",
    instagram: "Instagram",
    email: "Email",
    phone: "Phone",
  };
  return labels[source];
}
