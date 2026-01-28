import { ContactList } from "@/components/contacts/contact-list";
import { Input } from "@/components/ui/input";
import { getContacts } from "@/lib/services/contact-service";

export default async function ContactsPage() {
  const contacts = await getContacts({ limit: 50 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold text-warmGray-900">
          Contacts
        </h1>
        <div className="flex items-center gap-4">
          <div className="w-64">
            <Input
              type="search"
              placeholder="Search contacts..."
              className="text-sm"
            />
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        <button className="px-4 py-2 font-display text-sm bg-warmGray-900 text-cream">
          All ({contacts.length})
        </button>
        <button className="px-4 py-2 font-display text-sm text-warmGray-600 hover:bg-warmGray-100 transition-colors">
          Strong
        </button>
        <button className="px-4 py-2 font-display text-sm text-warmGray-600 hover:bg-warmGray-100 transition-colors">
          Needs Attention
        </button>
        <button className="px-4 py-2 font-display text-sm text-warmGray-600 hover:bg-warmGray-100 transition-colors">
          Archived
        </button>
      </div>

      <ContactList contacts={contacts} />
    </div>
  );
}
