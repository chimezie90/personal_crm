import Link from "next/link";
import { formatRelativeTime } from "@/lib/utils";

interface AttentionContact {
  id: string;
  name: string;
  lastInteraction: Date | null;
  recentCount: number;
  lastMessage?: string | null;
}

interface AttentionListProps {
  contacts: AttentionContact[];
}

export function AttentionList({ contacts }: AttentionListProps) {
  if (contacts.length === 0) {
    return (
      <p className="text-sm text-warmGray-500">
        No contacts need attention right now.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {contacts.map((contact) => (
        <Link
          key={contact.id}
          href={`/contacts/${contact.id}`}
          className="block border border-warmGray-200 bg-warmGray-50 px-3 py-2 hover:bg-warmGray-100 transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="font-display text-sm text-warmGray-900">
              {contact.name}
            </span>
            <span className="text-xs text-terracotta-600">
              {contact.lastInteraction
                ? formatRelativeTime(contact.lastInteraction)
                : "No activity"}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-warmGray-500 mt-1">
            <span>{contact.lastMessage || "No recent message"}</span>
            <span>{contact.recentCount} in last 30d</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
