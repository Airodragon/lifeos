"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "ghost" | "destructive" | "outline" | "link";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97]",
          {
            "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm":
              variant === "default",
            "bg-muted text-foreground hover:bg-muted/80":
              variant === "secondary",
            "hover:bg-accent hover:text-accent-foreground":
              variant === "ghost",
            "bg-destructive text-white hover:bg-destructive/90":
              variant === "destructive",
            "border border-border bg-transparent hover:bg-accent":
              variant === "outline",
            "text-primary underline-offset-4 hover:underline p-0 h-auto":
              variant === "link",
          },
          {
            "h-10 px-4 py-2 text-sm": size === "default",
            "h-8 px-3 text-xs": size === "sm",
            "h-12 px-6 text-base": size === "lg",
            "h-10 w-10": size === "icon",
          },
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
