import { cn } from "@/lib/utils";
import { type HTMLAttributes } from "react";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "destructive" | "warning" | "secondary";
}

export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
        {
          "bg-primary/10 text-primary": variant === "default",
          "bg-success/10 text-success": variant === "success",
          "bg-destructive/10 text-destructive": variant === "destructive",
          "bg-warning/10 text-warning": variant === "warning",
          "bg-muted text-muted-foreground": variant === "secondary",
        },
        className
      )}
      {...props}
    />
  );
}
