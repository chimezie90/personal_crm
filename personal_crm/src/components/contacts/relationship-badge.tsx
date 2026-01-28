"use client";

import { cn } from "@/lib/utils";

interface RelationshipBadgeProps {
  score: number;
  size?: "sm" | "md";
}

function getScoreInfo(score: number): {
  label: string;
  colorClass: string;
  bgClass: string;
} {
  if (score >= 70) {
    return {
      label: "Strong",
      colorClass: "text-sage-700",
      bgClass: "bg-sage-100 border-sage-300",
    };
  }
  if (score >= 40) {
    return {
      label: "Healthy",
      colorClass: "text-sage-600",
      bgClass: "bg-sage-50 border-sage-200",
    };
  }
  return {
    label: "Fading",
    colorClass: "text-terracotta-700",
    bgClass: "bg-terracotta-50 border-terracotta-200",
  };
}

export function RelationshipBadge({ score, size = "md" }: RelationshipBadgeProps) {
  const { label, colorClass, bgClass } = getScoreInfo(score);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 border font-display",
        bgClass,
        colorClass,
        size === "sm" ? "text-xs" : "text-sm"
      )}
      title={`Relationship score: ${Math.round(score)}/100`}
    >
      <span className="font-bold">{Math.round(score)}</span>
      <span className="text-xs opacity-75">{label}</span>
    </div>
  );
}
