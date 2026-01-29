import { z } from "zod";

export const scoreBreakdownSchema = z.object({
  recency: z.number().min(0).max(100).default(0),
  frequency: z.number().min(0).max(100).default(0),
  balance: z.number().min(0).max(100).default(0),
});

export type ScoreBreakdown = z.infer<typeof scoreBreakdownSchema>;

export const contactMetadataSchema = z.object({
  college: z.string().optional(),
  linkedIn: z.string().url().optional(),
  twitter: z.string().optional(),
  website: z.string().url().optional(),
}).passthrough();

export type ContactMetadata = z.infer<typeof contactMetadataSchema>;

export function parseJsonField<T>(
  json: string | null | undefined,
  schema: z.ZodSchema<T>,
  defaultValue: T
): T {
  if (!json) return defaultValue;

  try {
    return schema.parse(JSON.parse(json));
  } catch {
    return defaultValue;
  }
}

export function stringifyJsonField<T>(value: T): string {
  return JSON.stringify(value);
}

export const DEFAULT_SCORE_BREAKDOWN: ScoreBreakdown = {
  recency: 0,
  frequency: 0,
  balance: 0,
};

export const DEFAULT_CONTACT_METADATA: ContactMetadata = {};
