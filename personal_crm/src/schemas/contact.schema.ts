import { z } from "zod";

export const identitySchema = z.object({
  type: z.enum(["phone", "email", "group", "social"]),
  value: z.string(),
  source: z.enum(["imessage", "whatsapp", "facebook", "instagram", "email", "phone"]),
});

export type Identity = z.infer<typeof identitySchema>;

export const relationshipStrengthSchema = z.enum(["strong", "moderate", "weak", "new"]);

export type RelationshipStrength = z.infer<typeof relationshipStrengthSchema>;

export const contactSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  photoUrl: z.string().nullable(),

  // Profile fields
  company: z.string().nullable(),
  jobTitle: z.string().nullable(),
  city: z.string().nullable(),

  relationshipScore: z.number().min(0).max(100),
  relationshipStrength: relationshipStrengthSchema,
  lastInteraction: z.date().nullable(),
  identities: z.array(identitySchema),
  tags: z.array(z.string()),
  notes: z.string().nullable(),
  archived: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Contact = z.infer<typeof contactSchema>;

export const createContactSchema = z.object({
  displayName: z.string().min(1, "Display name is required"),
  photoUrl: z.string().url().optional().nullable(),
  identities: z.array(identitySchema).min(1, "At least one identity is required"),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional().nullable(),
});

export type CreateContactInput = z.infer<typeof createContactSchema>;

export const updateContactSchema = z.object({
  displayName: z.string().min(1).optional(),
  photoUrl: z.string().url().optional().nullable(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional().nullable(),
  archived: z.boolean().optional(),
  relationshipScore: z.number().min(0).max(100).optional(),
});

export type UpdateContactInput = z.infer<typeof updateContactSchema>;

/**
 * Parse identities JSON string from database
 */
export function parseIdentities(json: string): Identity[] {
  try {
    const parsed = JSON.parse(json);
    return z.array(identitySchema).parse(parsed);
  } catch (error) {
    console.warn(`[parseIdentities] Failed to parse JSON: ${json.slice(0, 100)}...`, error);
    return [];
  }
}

/**
 * Parse tags JSON string from database
 */
export function parseTags(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    return z.array(z.string()).parse(parsed);
  } catch (error) {
    console.warn(`[parseTags] Failed to parse JSON: ${json.slice(0, 100)}...`, error);
    return [];
  }
}

/**
 * Convert database row to Contact type
 */
export function dbRowToContact(row: {
  id: string;
  displayName: string;
  photoUrl: string | null;
  company?: string | null;
  jobTitle?: string | null;
  city?: string | null;
  relationshipScore: number;
  relationshipStrength: string;
  lastInteraction: Date | null;
  identities: string;
  tags: string;
  notes: string | null;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}): Contact {
  return {
    id: row.id,
    displayName: row.displayName,
    photoUrl: row.photoUrl,
    company: row.company ?? null,
    jobTitle: row.jobTitle ?? null,
    city: row.city ?? null,
    relationshipScore: row.relationshipScore,
    relationshipStrength: relationshipStrengthSchema.parse(row.relationshipStrength),
    lastInteraction: row.lastInteraction,
    identities: parseIdentities(row.identities),
    tags: parseTags(row.tags),
    notes: row.notes,
    archived: row.archived,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
