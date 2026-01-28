"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { RelationshipBadge } from "./relationship-badge";
import { Contact } from "@/schemas/contact.schema";
import { formatRelativeTime } from "@/lib/utils";

interface ContactCardProps {
  contact: Contact;
  lastMessage?: string;
}

export function ContactCard({ contact, lastMessage }: ContactCardProps) {
  return (
    <Link href={`/contacts/${contact.id}`}>
      <div
        className="group relative bg-cream border-2 border-warmGray-900 p-4
                      hover:shadow-brutal hover:-translate-x-0.5 hover:-translate-y-0.5
                      transition-all duration-150"
      >
        <div className="flex items-start gap-4">
          <Avatar
            src={contact.photoUrl}
            fallback={contact.displayName}
            className="flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display font-medium text-warmGray-900 truncate">
                {contact.displayName}
              </h3>
              <RelationshipBadge score={contact.relationshipScore} size="sm" />
            </div>
            {lastMessage && (
              <p className="text-sm text-warmGray-600 truncate mt-1">
                {lastMessage}
              </p>
            )}
            {contact.lastInteraction && (
              <p className="text-xs text-warmGray-400 mt-1">
                {formatRelativeTime(contact.lastInteraction)}
              </p>
            )}
          </div>
        </div>

        {contact.tags.length > 0 && (
          <div className="mt-3 flex gap-1 flex-wrap">
            {contact.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 text-xs font-medium
                           bg-sage/20 text-sage border border-sage/30"
              >
                {tag}
              </span>
            ))}
            {contact.tags.length > 3 && (
              <span className="px-2 py-0.5 text-xs text-warmGray-500">
                +{contact.tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
