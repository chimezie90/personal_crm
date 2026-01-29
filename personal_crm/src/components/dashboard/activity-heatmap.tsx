"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

interface HeatmapData {
  date: string; // YYYY-MM-DD
  count: number;
}

interface ActivityHeatmapProps {
  data: HeatmapData[];
  weeks?: number;
}

export function ActivityHeatmap({ data, weeks = 52 }: ActivityHeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<{
    date: string;
    count: number;
  } | null>(null);

  const { grid, max, countsByDate, totalMessages, activeDays } = useMemo(() => {
    const counts = new Map(data.map(d => [d.date, d.count]));
    const maxCount = Math.max(...data.map(d => d.count), 1);

    // Generate weeks grid starting from today going back
    const today = new Date();
    const grid: Date[][] = [];

    for (let w = weeks - 1; w >= 0; w--) {
      const week: Date[] = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(today);
        date.setDate(today.getDate() - w * 7 - (6 - d));
        week.push(date);
      }
      grid.push(week);
    }

    return {
      grid,
      max: maxCount,
      countsByDate: counts,
      totalMessages: data.reduce((sum, d) => sum + d.count, 0),
      activeDays: data.filter(d => d.count > 0).length,
    };
  }, [data, weeks]);

  const getIntensity = (count: number): string => {
    if (count === 0) return "bg-warmGray-100";
    const ratio = count / max;
    if (ratio <= 0.25) return "bg-sage-200";
    if (ratio <= 0.5) return "bg-sage-300";
    if (ratio <= 0.75) return "bg-sage-400";
    return "bg-sage-500";
  };

  const formatDateLabel = (date: string) => {
    const d = new Date(date + "T00:00:00");
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div
      role="img"
      aria-label={`Activity heatmap showing ${totalMessages.toLocaleString()} total messages`}
      className="relative"
    >
      {/* Screen reader summary */}
      <div className="sr-only">
        {activeDays} active days with up to {max} messages on the busiest day.
      </div>

      <div
        className="flex gap-0.5 overflow-x-auto pb-2"
        aria-hidden="true"
      >
        {grid.map((week, weekIndex) => (
          <div key={weekIndex} className="flex flex-col gap-0.5">
            {week.map(day => {
              const dateKey = day.toISOString().slice(0, 10);
              const count = countsByDate.get(dateKey) ?? 0;

              return (
                <div
                  key={dateKey}
                  className={cn(
                    "w-3 h-3 border border-warmGray-300 cursor-pointer transition-transform hover:scale-125",
                    getIntensity(count)
                  )}
                  onMouseEnter={() => setHoveredCell({ date: dateKey, count })}
                  onMouseLeave={() => setHoveredCell(null)}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* Tooltip */}
      {hoveredCell && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full bg-warmGray-900 text-cream px-2 py-1 text-xs whitespace-nowrap z-10 pointer-events-none">
          {formatDateLabel(hoveredCell.date)}: {hoveredCell.count} message
          {hoveredCell.count !== 1 ? "s" : ""}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-end gap-2 mt-3 text-xs text-warmGray-600">
        <span>Less</span>
        <div className="flex gap-0.5">
          {[
            "bg-warmGray-100",
            "bg-sage-200",
            "bg-sage-300",
            "bg-sage-400",
            "bg-sage-500",
          ].map((color, i) => (
            <div
              key={i}
              className={cn("w-3 h-3 border border-warmGray-300", color)}
            />
          ))}
        </div>
        <span>More</span>
      </div>
    </div>
  );
}
