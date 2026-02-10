import { db } from "@/lib/db";
import { PrismaClient } from "@/generated/prisma/client";
import { normalizePhoneNumber, normalizeEmail } from "@/lib/utils";
import { Identity, parseIdentities, dbRowToContact } from "@/schemas/contact.schema";
import { RawContact, DataSourceType } from "@/lib/connectors/types";

// Transaction client type for Prisma
type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/**
 * Normalize an identifier (phone or email) for matching
 */
export function normalizeIdentifier(identifier: string): {
  type: "phone" | "email" | "group";
  normalized: string;
} {
  if (identifier.startsWith("group:")) {
    return { type: "group", normalized: identifier.slice("group:".length) };
  }
  if (identifier.includes("@")) {
    return { type: "email", normalized: normalizeEmail(identifier) };
  }
  return { type: "phone", normalized: normalizePhoneNumber(identifier) };
}

/**
 * Find an existing contact that matches the given raw contact
 * Uses deterministic matching on phone/email
 * @param rawContact - The raw contact data to match against
 * @param client - Optional transaction client, defaults to db
 */
export async function findMatchingContact(
  rawContact: RawContact,
  client: TransactionClient = db
): Promise<string | null> {
  const { normalized } = normalizeIdentifier(rawContact.identifier);

  // Search through all contacts for a matching identity
  const contacts = await client.contact.findMany({
    where: {
      identities: { contains: normalized },
    },
    take: 1,
  });

  if (contacts.length > 0) {
    return contacts[0].id;
  }

  return null;
}

/**
 * Find or create a contact for the given raw contact data
 * Uses a transaction to prevent race conditions that could create duplicate contacts
 */
export async function findOrCreateContact(
  rawContact: RawContact,
  source: DataSourceType
): Promise<string> {
  return db.$transaction(async (tx) => {
    const existingId = await findMatchingContact(rawContact, tx);

    if (existingId) {
      // Update the contact with any new identities
      await addIdentityToContact(existingId, rawContact.identifier, source, tx);
      return existingId;
    }

    // Create a new contact
    const { type, normalized } = normalizeIdentifier(rawContact.identifier);
    const identity: Identity = {
      type,
      value: normalized,
      source,
    };

    const contact = await tx.contact.create({
      data: {
        displayName: rawContact.displayName || normalized,
        photoUrl: rawContact.photoUrl ?? null,
        identities: JSON.stringify([identity]),
        tags: "[]",
      },
    });

    return contact.id;
  });
}

/**
 * Add a new identity to an existing contact if not already present
 * @param contactId - The ID of the contact to update
 * @param identifier - The identifier to add (phone, email, or group)
 * @param source - The data source type
 * @param client - Optional transaction client, defaults to db
 */
export async function addIdentityToContact(
  contactId: string,
  identifier: string,
  source: DataSourceType,
  client: TransactionClient = db
): Promise<void> {
  const contact = await client.contact.findUnique({
    where: { id: contactId },
  });

  if (!contact) return;

  const { type, normalized } = normalizeIdentifier(identifier);
  const identities = parseIdentities(contact.identities);

  // Check if this identity already exists
  const exists = identities.some(
    (i) => i.value === normalized && i.source === source
  );

  if (exists) return;

  // Add the new identity
  identities.push({ type, value: normalized, source });

  await client.contact.update({
    where: { id: contactId },
    data: { identities: JSON.stringify(identities) },
  });
}

/**
 * Merge two contacts into one
 * The target contact receives all identities and messages from the source
 * Uses a transaction to ensure atomicity - all operations succeed or none do
 */
export async function mergeContacts(
  targetId: string,
  sourceId: string
): Promise<void> {
  await db.$transaction(async (tx) => {
    const [target, source] = await Promise.all([
      tx.contact.findUnique({ where: { id: targetId } }),
      tx.contact.findUnique({ where: { id: sourceId } }),
    ]);

    if (!target || !source) {
      throw new Error("One or both contacts not found");
    }

    // Merge identities
    const targetIdentities = parseIdentities(target.identities);
    const sourceIdentities = parseIdentities(source.identities);

    for (const identity of sourceIdentities) {
      const exists = targetIdentities.some(
        (i) => i.value === identity.value && i.source === identity.source
      );
      if (!exists) {
        targetIdentities.push(identity);
      }
    }

    // Move all messages from source to target
    await tx.message.updateMany({
      where: { contactId: sourceId },
      data: { contactId: targetId },
    });

    // Update target with merged identities
    await tx.contact.update({
      where: { id: targetId },
      data: {
        identities: JSON.stringify(targetIdentities),
        // Use the more recent last interaction
        lastInteraction:
          (source.lastInteraction && target.lastInteraction
            ? source.lastInteraction > target.lastInteraction
              ? source.lastInteraction
              : target.lastInteraction
            : source.lastInteraction || target.lastInteraction),
      },
    });

    // Delete the source contact
    await tx.contact.delete({ where: { id: sourceId } });
  });
}

/**
 * Build identity lookup index from contacts
 * Returns a map of normalized identifier -> contact ID
 */
export async function buildIdentityIndex(): Promise<Map<string, string>> {
  const index = new Map<string, string>();
  const contacts = await db.contact.findMany();

  for (const contact of contacts) {
    const identities = parseIdentities(contact.identities);
    for (const identity of identities) {
      index.set(identity.value, contact.id);
    }
  }

  return index;
}
