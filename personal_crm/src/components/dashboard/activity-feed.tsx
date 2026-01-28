"use client";

import { Avatar } from "@/components/ui/avatar";

interface Activity {
  id: string;
  contactName: string;
  contactPhoto?: string;
  action: string;
  timestamp: Date;
  source: "imessage" | "whatsapp" | "facebook" | "email" | "phone";
}

const sourceIcons = {
  imessage: "💬",
  whatsapp: "📱",
  facebook: "👤",
  email: "✉️",
  phone: "📞",
};

function EmptyState() {
  return (
    <div className="text-center py-8 text-warmGray-500">
      <p className="font-display text-lg">No recent activity</p>
      <p className="text-sm mt-1">
        Connect a data source to see your communication history
      </p>
    </div>
  );
}

interface ActivityFeedProps {
  activities?: Activity[];
}

export function ActivityFeed({ activities = [] }: ActivityFeedProps) {
  if (activities.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-4">
      {activities.map((activity) => (
        <div key={activity.id} className="flex items-start gap-3">
          <Avatar
            src={activity.contactPhoto}
            fallback={activity.contactName}
            size="sm"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-warmGray-900">
              <span className="font-medium">{activity.contactName}</span>{" "}
              {activity.action}
            </p>
            <p className="text-xs text-warmGray-500 mt-0.5">
              {sourceIcons[activity.source]}{" "}
              {activity.timestamp.toLocaleString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
