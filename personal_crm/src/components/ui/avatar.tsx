"use client";

import { cn } from "@/lib/utils";

interface AvatarProps {
  src?: string | null;
  fallback: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "w-8 h-8 text-xs",
  md: "w-12 h-12 text-sm",
  lg: "w-16 h-16 text-lg",
};

export function Avatar({
  src,
  fallback,
  className,
  size = "md",
}: AvatarProps) {
  const initials = fallback
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  if (src) {
    return (
      <img
        src={src}
        alt={fallback}
        className={cn(
          "rounded-full border-2 border-warmGray-900 object-cover",
          sizeClasses[size],
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full border-2 border-warmGray-900 bg-sage-100 flex items-center justify-center font-display font-bold text-sage-700",
        sizeClasses[size],
        className
      )}
    >
      {initials}
    </div>
  );
}
