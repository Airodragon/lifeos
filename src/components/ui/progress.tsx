"use client";

import { cn } from "@/lib/utils";

interface ProgressProps {
  value: number;
  max?: number;
  className?: string;
  indicatorClassName?: string;
  size?: "sm" | "md" | "lg";
}

export function Progress({
  value,
  max = 100,
  className,
  indicatorClassName,
  size = "md",
}: ProgressProps) {
  const percent = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-full bg-muted",
        {
          "h-1.5": size === "sm",
          "h-2.5": size === "md",
          "h-4": size === "lg",
        },
        className
      )}
    >
      <div
        className={cn(
          "h-full rounded-full transition-all duration-500 ease-out",
          percent > 90 ? "bg-destructive" : percent > 70 ? "bg-warning" : "bg-success",
          indicatorClassName
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
