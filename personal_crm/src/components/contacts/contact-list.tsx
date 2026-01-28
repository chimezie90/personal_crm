"use client";

import { Contact } from "@/schemas/contact.schema";
import { ContactCard } from "./contact-card";

interface ContactListProps {
  contacts: Contact[];
  lastMessages?: Record<string, string>;
}

function EmptyState() {
  return (
    <div className="text-center py-16 border-2 border-dashed border-warmGray-300">
      <div className="text-4xl mb-4">👥</div>
      <h3 className="font-display text-xl font-bold text-warmGray-900 mb-2">
        No contacts yet
      </h3>
      <p className="text-warmGray-600 max-w-md mx-auto">
        Connect a data source like iMessage to import your contacts and start
        tracking your relationships.
      </p>
    </div>
  );
}

export function ContactList({ contacts, lastMessages = {} }: ContactListProps) {
  if (contacts.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {contacts.map((contact) => (
        <ContactCard
          key={contact.id}
          contact={contact}
          lastMessage={lastMessages[contact.id]}
        />
      ))}
    </div>
  );
}
