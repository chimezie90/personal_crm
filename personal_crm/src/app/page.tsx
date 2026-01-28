import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { RelationshipChart } from "@/components/dashboard/relationship-chart";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold text-warmGray-900">
          Dashboard
        </h1>
        <button className="btn-primary">Sync Now</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stats Cards */}
        <div className="card">
          <p className="text-sm text-warmGray-500 font-display uppercase tracking-wide">
            Total Contacts
          </p>
          <p className="text-4xl font-display font-bold text-warmGray-900 mt-1">
            0
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-warmGray-500 font-display uppercase tracking-wide">
            Messages This Week
          </p>
          <p className="text-4xl font-display font-bold text-warmGray-900 mt-1">
            0
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-warmGray-500 font-display uppercase tracking-wide">
            Need Attention
          </p>
          <p className="text-4xl font-display font-bold text-terracotta mt-1">
            0
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-display text-xl font-bold text-warmGray-900 mb-4">
            Relationship Health
          </h2>
          <RelationshipChart />
        </div>

        <div className="card">
          <h2 className="font-display text-xl font-bold text-warmGray-900 mb-4">
            Recent Activity
          </h2>
          <ActivityFeed />
        </div>
      </div>
    </div>
  );
}
