import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, type, ...props }, ref) => {
    const isDateTimeLike = type === "datetime-local" || type === "date" || type === "time";
    return (
      <div className="space-y-1.5 min-w-0">
        {label && (
          <label className="block text-sm font-medium text-foreground leading-tight">
            {label}
          </label>
        )}
        <input
          type={type}
          className={cn(
            "flex h-11 w-full min-w-0 max-w-full rounded-xl border border-input bg-background px-4 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:cursor-not-allowed disabled:opacity-50",
            isDateTimeLike &&
              "px-3 sm:px-4 overflow-hidden [appearance:textfield] [&::-webkit-date-and-time-value]:text-left [&::-webkit-date-and-time-value]:whitespace-nowrap [&::-webkit-calendar-picker-indicator]:opacity-80 [&::-webkit-calendar-picker-indicator]:cursor-pointer",
            error && "border-destructive focus:ring-destructive/20",
            className
          )}
          ref={ref}
          {...props}
        />
        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };
