import { db } from "@/lib/db";
import {
  Contact,
  CreateContactInput,
  UpdateContactInput,
  dbRowToContact,
} from "@/schemas/contact.schema";

/**
 * Get all contacts, optionally filtered
 */
export async function getContacts(options?: {
  archived?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
  orderBy?: "relationshipScore" | "lastInteraction" | "displayName" | "messageCount";
  orderDir?: "asc" | "desc";
}): Promise<Contact[]> {
  const {
    archived = false,
    search,
    limit = 50,
    offset = 0,
    orderBy = "lastInteraction",
    orderDir = "desc",
  } = options || {};

  const whereClause = {
    archived,
    ...(search && {
      OR: [
        { displayName: { contains: search } },
        { identities: { contains: search } },
        { notes: { contains: search } },
      ],
    }),
  };

  if (orderBy === "messageCount") {
    const contacts = await db.contact.findMany({
      where: whereClause,
    });

    const ids = contacts.map(contact => contact.id);
    const countMap = new Map<string, number>();

    // Chunk ids to avoid SQLite query parameter limit
    const chunkSize = 500;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const counts = await db.message.groupBy({
        by: ["contactId"],
        _count: { _all: true },
        where: { contactId: { in: chunk } },
      });

      for (const row of counts) {
        countMap.set(row.contactId, row._count._all);
      }
    }

    const sorted = contacts.sort((a, b) => {
      const aCount = countMap.get(a.id) ?? 0;
      const bCount = countMap.get(b.id) ?? 0;
      return orderDir === "asc" ? aCount - bCount : bCount - aCount;
    });

    return sorted.slice(offset, offset + limit).map(dbRowToContact);
  }

  const contacts = await db.contact.findMany({
    where: whereClause,
    orderBy: { [orderBy]: orderDir },
    take: limit,
    skip: offset,
  });

  return contacts.map(dbRowToContact);
}

/**
 * Get a single contact by ID
 */
export async function getContact(id: string): Promise<Contact | null> {
  const contact = await db.contact.findUnique({
    where: { id },
  });

  if (!contact) return null;
  return dbRowToContact(contact);
}

/**
 * Create a new contact
 */
export async function createContact(input: CreateContactInput): Promise<Contact> {
  const contact = await db.contact.create({
    data: {
      displayName: input.displayName,
      photoUrl: input.photoUrl ?? null,
      identities: JSON.stringify(input.identities),
      tags: JSON.stringify(input.tags),
      notes: input.notes ?? null,
    },
  });

  return dbRowToContact(contact);
}

/**
 * Update an existing contact
 */
export async function updateContact(
  id: string,
  input: UpdateContactInput
): Promise<Contact | null> {
  const existing = await db.contact.findUnique({ where: { id } });
  if (!existing) return null;

  const contact = await db.contact.update({
    where: { id },
    data: {
      ...(input.displayName !== undefined && { displayName: input.displayName }),
      ...(input.photoUrl !== undefined && { photoUrl: input.photoUrl }),
      ...(input.tags !== undefined && { tags: JSON.stringify(input.tags) }),
      ...(input.notes !== undefined && { notes: input.notes }),
      ...(input.archived !== undefined && { archived: input.archived }),
      ...(input.relationshipScore !== undefined && {
        relationshipScore: input.relationshipScore,
      }),
    },
  });

  return dbRowToContact(contact);
}

/**
 * Delete a contact and all associated messages
 */
export async function deleteContact(id: string): Promise<boolean> {
  const existing = await db.contact.findUnique({ where: { id } });
  if (!existing) return false;

  await db.contact.delete({ where: { id } });
  return true;
}

/**
 * Get contact count
 */
export async function getContactCount(archived = false): Promise<number> {
  return db.contact.count({
    where: { archived },
  });
}

/**
 * Find contact by identity (phone or email)
 */
export async function findContactByIdentity(
  identifier: string
): Promise<Contact | null> {
  // Search in the identities JSON field
  const contacts = await db.contact.findMany({
    where: {
      identities: { contains: identifier },
    },
    take: 1,
  });

  if (contacts.length === 0) return null;
  return dbRowToContact(contacts[0]);
}

/**
 * Update contact's last interaction time
 */
export async function updateLastInteraction(
  id: string,
  timestamp: Date
): Promise<void> {
  await db.contact.update({
    where: { id },
    data: { lastInteraction: timestamp },
  });
}

/**
 * Get contacts that need attention (no interaction in X days)
 */
export async function getContactsNeedingAttention(
  days: number = 30
): Promise<Contact[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const contacts = await db.contact.findMany({
    where: {
      archived: false,
      lastInteraction: { lt: cutoff },
    },
    orderBy: { lastInteraction: "asc" },
    take: 10,
  });

  return contacts.map(dbRowToContact);
}
