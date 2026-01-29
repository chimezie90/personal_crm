import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { RelationshipChart } from "@/components/dashboard/relationship-chart";
import { MessageCadence } from "@/components/dashboard/message-cadence";
import { ActivityHeatmap } from "@/components/dashboard/activity-heatmap";
import { TopContactsList } from "@/components/dashboard/top-contacts";
import { AttentionList } from "@/components/dashboard/attention-list";
import { getDashboardStats } from "@/actions/sync.actions";
import {
  getRecentMessages,
  getMessageCountsByContact,
  getMessageCadence,
  getLatestMessagesPerContact,
} from "@/lib/services/message-service";
import { getContacts } from "@/lib/services/contact-service";
import {
  getDailyMessageCounts,
  getTopContacts,
} from "@/lib/services/analytics-service";
import { DashboardActions } from "@/components/dashboard/dashboard-actions";

export default async function DashboardPage() {
  const contacts = await getContacts({ limit: 200 });
  const contactIds = contacts.map(contact => contact.id);

  const recentSince = new Date();
  recentSince.setDate(recentSince.getDate() - 30);

  // Heatmap date range: 1 year back from today
  const heatmapEndDate = new Date();
  const heatmapStartDate = new Date();
  heatmapStartDate.setFullYear(heatmapStartDate.getFullYear() - 1);

  const [
    stats,
    recentMessages,
    recentCounts,
    cadence,
    latestMessages,
    heatmapData,
    topContacts,
  ] = await Promise.all([
    getDashboardStats(),
    getRecentMessages(10),
    getMessageCountsByContact(contactIds, recentSince),
    getMessageCadence(12),
    getLatestMessagesPerContact(contactIds),
    getDailyMessageCounts(heatmapStartDate, heatmapEndDate),
    getTopContacts(10),
  ]);

  const attentionList = contacts
    .map(contact => ({
      id: contact.id,
      name: contact.displayName,
      lastInteraction: contact.lastInteraction,
      recentCount: recentCounts[contact.id] ?? 0,
      lastMessage: latestMessages[contact.id]?.content ?? null,
    }))
    .sort((a, b) => {
      if (a.recentCount !== b.recentCount) {
        return a.recentCount - b.recentCount;
      }
      const aTime = a.lastInteraction?.getTime() ?? 0;
      const bTime = b.lastInteraction?.getTime() ?? 0;
      return aTime - bTime;
    })
    .slice(0, 8);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold text-warmGray-900">
          Dashboard
        </h1>
        <DashboardActions />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stats Cards */}
        <div className="card">
          <p className="text-sm text-warmGray-500 font-display uppercase tracking-wide">
            Total Contacts
          </p>
          <p className="text-4xl font-display font-bold text-warmGray-900 mt-1">
            {stats.totalContacts.toLocaleString()}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-warmGray-500 font-display uppercase tracking-wide">
            Messages This Week
          </p>
          <p className="text-4xl font-display font-bold text-warmGray-900 mt-1">
            {stats.messagesThisWeek.toLocaleString()}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-warmGray-500 font-display uppercase tracking-wide">
            Need Attention
          </p>
          <p className="text-4xl font-display font-bold text-terracotta mt-1">
            {stats.needAttention}
          </p>
        </div>
      </div>

      {/* Activity Heatmap - Full Width */}
      <div className="card">
        <h2 className="font-display text-xl font-bold text-warmGray-900 mb-4">
          Activity Over Time
        </h2>
        <ActivityHeatmap data={heatmapData} weeks={52} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-display text-xl font-bold text-warmGray-900 mb-4">
            Relationship Health
          </h2>
          <RelationshipChart contacts={contacts} />
        </div>

        <div className="card">
          <h2 className="font-display text-xl font-bold text-warmGray-900 mb-4">
            Weekly Message Cadence
          </h2>
          <MessageCadence data={cadence} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-2">
          <h2 className="font-display text-xl font-bold text-warmGray-900 mb-4">
            Top Contacts
          </h2>
          <TopContactsList contacts={topContacts} />
        </div>

        <div className="card">
          <h2 className="font-display text-xl font-bold text-warmGray-900 mb-4">
            Needs Attention
          </h2>
          <AttentionList contacts={attentionList} />
        </div>
      </div>

      <div className="card">
        <h2 className="font-display text-xl font-bold text-warmGray-900 mb-4">
          Recent Activity
        </h2>
        <ActivityFeed messages={recentMessages} />
      </div>
    </div>
  );
}
