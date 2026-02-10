import { notFound } from "next/navigation";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RelationshipBadge } from "@/components/contacts/relationship-badge";
import { ContactTimeline } from "@/components/contacts/contact-timeline";
import { ContactNotes } from "@/components/contacts/contact-notes";
import { ActivityHeatmap } from "@/components/dashboard/activity-heatmap";
import { EngagementBalance } from "@/components/contacts/engagement-balance";
import { getContact } from "@/lib/services/contact-service";
import {
  getContactMessages,
  getContactMessageStats,
} from "@/lib/services/message-service";
import {
  getDailyMessageCounts,
  getEngagementStats,
} from "@/lib/services/analytics-service";
import { formatRelativeTime, formatDate } from "@/lib/utils";
import { getSourceIcon, getSourceLabel } from "@/schemas/message.schema";

interface ContactPageProps {
  params: Promise<{ id: string }>;
}

export default async function ContactPage({ params }: ContactPageProps) {
  const { id } = await params;
  const contact = await getContact(id);

  if (!contact) {
    notFound();
  }

  // Heatmap date range: 1 year back from today
  const heatmapEndDate = new Date();
  const heatmapStartDate = new Date();
  heatmapStartDate.setFullYear(heatmapStartDate.getFullYear() - 1);

  const [messages, stats, heatmapData, engagementStats] = await Promise.all([
    getContactMessages(id, { limit: 100 }),
    getContactMessageStats(id),
    getDailyMessageCounts(heatmapStartDate, heatmapEndDate, id),
    getEngagementStats(id),
  ]);

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/contacts"
        className="inline-flex items-center gap-2 text-warmGray-600 hover:text-warmGray-900 transition-colors"
      >
        ← Back to contacts
      </Link>

      {/* Header */}
      <div className="flex items-start gap-6">
        <Avatar src={contact.photoUrl} fallback={contact.displayName} size="lg" />
        <div className="flex-1">
          <div className="flex items-center gap-4">
            <h1 className="font-display text-3xl font-bold text-warmGray-900">
              {contact.displayName}
            </h1>
            <RelationshipBadge score={contact.relationshipScore} />
          </div>

          {/* Profile Info: Company, Job Title, City */}
          {(contact.company || contact.jobTitle || contact.city) && (
            <p className="text-warmGray-600 mt-1">
              {[contact.jobTitle, contact.company, contact.city]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}

          {/* Identities */}
          <div className="flex flex-wrap gap-2 mt-2">
            {contact.identities.map((identity, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 text-sm text-warmGray-600 bg-warmGray-100 px-2 py-1"
              >
                {identity.type === "phone"
                  ? "📱"
                  : identity.type === "email"
                    ? "✉️"
                    : "👥"}
                {identity.value}
              </span>
            ))}
          </div>

          {/* Tags */}
          {contact.tags.length > 0 && (
            <div className="flex gap-1 mt-3">
              {contact.tags.map(tag => (
                <span
                  key={tag}
                  className="px-2 py-0.5 text-sm font-medium bg-sage/20 text-sage border border-sage/30"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="secondary">Edit</Button>
          <Button variant="ghost">Archive</Button>
        </div>
      </div>

      {/* Activity Heatmap - Full Width */}
      <Card>
        <h2 className="font-display text-xl font-bold text-warmGray-900 mb-4">
          Activity Over Time
        </h2>
        <ActivityHeatmap data={heatmapData} weeks={52} />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Timeline */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <h2 className="font-display text-xl font-bold text-warmGray-900 mb-4">
              Timeline
            </h2>
            <ContactTimeline messages={messages} />
          </Card>
        </div>

        {/* Right column - Stats & Notes */}
        <div className="space-y-6">
          {/* Engagement Balance */}
          <Card>
            <h3 className="font-display font-bold text-warmGray-900 mb-4">
              Engagement
            </h3>
            <EngagementBalance
              sent={engagementStats.messagesSent}
              received={engagementStats.messagesReceived}
            />
            {engagementStats.avgWordsPerMessage > 0 && (
              <p className="text-sm text-warmGray-500 mt-3">
                Avg. {engagementStats.avgWordsPerMessage} words per message
              </p>
            )}
          </Card>

          {/* Stats */}
          <Card>
            <h3 className="font-display font-bold text-warmGray-900 mb-4">
              Statistics
            </h3>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-warmGray-600">Total Messages</dt>
                <dd className="font-display font-bold">
                  {stats.total.toLocaleString()}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-warmGray-600">Sent</dt>
                <dd className="font-display">{stats.outbound.toLocaleString()}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-warmGray-600">Received</dt>
                <dd className="font-display">{stats.inbound.toLocaleString()}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-warmGray-600">Last Contact</dt>
                <dd className="font-display">
                  {contact.lastInteraction
                    ? formatRelativeTime(contact.lastInteraction)
                    : "Never"}
                </dd>
              </div>
            </dl>

            {/* Sources breakdown */}
            {Object.keys(stats.bySources).length > 0 && (
              <>
                <hr className="my-4 border-warmGray-200" />
                <h4 className="font-display text-sm font-medium text-warmGray-700 mb-2">
                  By Source
                </h4>
                <div className="space-y-2">
                  {Object.entries(stats.bySources).map(([source, count]) => (
                    <div key={source} className="flex justify-between text-sm">
                      <span className="text-warmGray-600">
                        {getSourceIcon(source as any)}{" "}
                        {getSourceLabel(source as any)}
                      </span>
                      <span className="font-display">{count}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>

          {/* Notes */}
          <ContactNotes contactId={contact.id} initialNotes={contact.notes} />

          {/* Metadata */}
          <Card>
            <h3 className="font-display font-bold text-warmGray-900 mb-4">
              Details
            </h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-warmGray-600">Added</dt>
                <dd>{formatDate(contact.createdAt)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-warmGray-600">Updated</dt>
                <dd>{formatDate(contact.updatedAt)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-warmGray-600">ID</dt>
                <dd className="font-mono text-xs text-warmGray-400">
                  {contact.id}
                </dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
