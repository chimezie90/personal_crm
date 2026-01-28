"use client";

interface RelationshipData {
  strong: number; // 70-100
  healthy: number; // 40-69
  needsAttention: number; // 0-39
}

function EmptyState() {
  return (
    <div className="text-center py-8 text-warmGray-500">
      <p className="font-display text-lg">No relationship data yet</p>
      <p className="text-sm mt-1">Import your contacts to see relationship health</p>
    </div>
  );
}

interface RelationshipChartProps {
  data?: RelationshipData;
}

export function RelationshipChart({ data }: RelationshipChartProps) {
  if (!data || (data.strong === 0 && data.healthy === 0 && data.needsAttention === 0)) {
    return <EmptyState />;
  }

  const total = data.strong + data.healthy + data.needsAttention;
  const strongPercent = (data.strong / total) * 100;
  const healthyPercent = (data.healthy / total) * 100;
  const needsAttentionPercent = (data.needsAttention / total) * 100;

  return (
    <div className="space-y-4">
      {/* Bar chart */}
      <div className="h-8 flex border-2 border-warmGray-900 overflow-hidden">
        {strongPercent > 0 && (
          <div
            className="bg-sage-500 h-full"
            style={{ width: `${strongPercent}%` }}
            title={`Strong: ${data.strong}`}
          />
        )}
        {healthyPercent > 0 && (
          <div
            className="bg-sage-300 h-full"
            style={{ width: `${healthyPercent}%` }}
            title={`Healthy: ${data.healthy}`}
          />
        )}
        {needsAttentionPercent > 0 && (
          <div
            className="bg-terracotta h-full"
            style={{ width: `${needsAttentionPercent}%` }}
            title={`Needs Attention: ${data.needsAttention}`}
          />
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-sage-500 border border-warmGray-900" />
          <span>Strong ({data.strong})</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-sage-300 border border-warmGray-900" />
          <span>Healthy ({data.healthy})</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-terracotta border border-warmGray-900" />
          <span>Needs Attention ({data.needsAttention})</span>
        </div>
      </div>
    </div>
  );
}
