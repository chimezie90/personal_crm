import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { formatRelativeTime } from "@/lib/utils";

interface TopContact {
  id: string;
  displayName: string;
  photoUrl: string | null;
  messageCount: number;
  lastInteraction: Date | null;
  relationshipScore: number;
}

interface TopContactsListProps {
  contacts: TopContact[];
}

export function TopContactsList({ contacts }: TopContactsListProps) {
  if (contacts.length === 0) {
    return (
      <div className="text-center py-8 text-warmGray-500">
        <p>No contacts yet</p>
        <p className="text-sm mt-1">
          Sync a data source to see your top connections
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {contacts.slice(0, 10).map((contact, index) => (
        <Link
          key={contact.id}
          href={`/contacts/${contact.id}`}
          className="flex items-center gap-3 p-3 -mx-3 hover:bg-warmGray-50 transition-colors"
        >
          <span className="text-2xl font-display text-warmGray-300 w-8 text-center tabular-nums">
            {index + 1}
          </span>
          <Avatar
            src={contact.photoUrl}
            fallback={contact.displayName}
            size="sm"
          />
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{contact.displayName}</p>
            <p className="text-sm text-warmGray-500">
              {contact.messageCount.toLocaleString()} messages
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm font-display tabular-nums">
              {Math.round(contact.relationshipScore)}
            </div>
            <p className="text-xs text-warmGray-500">
              {contact.lastInteraction
                ? formatRelativeTime(contact.lastInteraction)
                : "Never"}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
