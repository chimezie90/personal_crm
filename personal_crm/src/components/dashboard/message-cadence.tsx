import { formatDate } from "@/lib/utils";

interface MessageCadenceProps {
  data: Array<{ start: Date; count: number }>;
}

export function MessageCadence({ data }: MessageCadenceProps) {
  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-1 h-24">
        {data.map((point) => {
          const height = Math.max(6, Math.round((point.count / max) * 100));
          return (
            <div
              key={point.start.toISOString()}
              className="flex-1 bg-sage-300 border border-warmGray-900"
              style={{ height: `${height}%` }}
              title={`${formatDate(point.start)}: ${point.count}`}
            />
          );
        })}
      </div>

      <div className="flex items-center justify-between text-xs text-warmGray-500">
        <span>{formatDate(data[0].start)}</span>
        <span>{formatDate(data[data.length - 1].start)}</span>
      </div>
    </div>
  );
}
