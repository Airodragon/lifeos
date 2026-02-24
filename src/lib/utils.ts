import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(
  amount: number,
  currency: string = "INR",
  compact: boolean = false
): string {
  const formatter = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: compact ? 0 : 2,
    maximumFractionDigits: compact ? 0 : 2,
    notation: compact ? "compact" : "standard",
  });
  return formatter.format(amount);
}

export function formatPercent(value: number, digits: number = 1): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function trimZeroes(value: string) {
  return value.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

export function formatCompactIndianCurrency(
  amount: number,
  currency: string = "INR"
): string {
  if (!Number.isFinite(amount)) return `${currency === "INR" ? "₹" : ""}0`;

  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  const symbol = currency === "INR" ? "₹" : "";

  if (currency !== "INR") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      notation: "compact",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  if (abs >= 10000000) {
    return `${sign}${symbol}${trimZeroes((abs / 10000000).toFixed(2))}Cr`;
  }
  if (abs >= 100000) {
    return `${sign}${symbol}${trimZeroes((abs / 100000).toFixed(2))}L`;
  }
  if (abs >= 1000) {
    return `${sign}${symbol}${trimZeroes((abs / 1000).toFixed(2))}K`;
  }
  return `${sign}${symbol}${trimZeroes(abs.toFixed(2))}`;
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateShort(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

export function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function getMonthName(month: number): string {
  return new Date(2024, month - 1).toLocaleString("en", { month: "long" });
}

export function getRelativeTime(date: Date | string): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDateShort(d);
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function toDecimal(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return parseFloat(value);
  if (value && typeof value === "object" && "toNumber" in value) {
    return (value as { toNumber(): number }).toNumber();
  }
  return 0;
}
