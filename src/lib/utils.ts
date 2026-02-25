import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const IST_TIMEZONE = "Asia/Kolkata";
const IST_OFFSET_MINUTES = 330;

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

export function formatDecimalRange(
  value: number,
  minimumFractionDigits: number = 2,
  maximumFractionDigits: number = 4
): string {
  if (!Number.isFinite(value)) return "0";
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(value);
}

export function formatCurrencyRange(
  amount: number,
  currency: string = "INR",
  minimumFractionDigits: number = 2,
  maximumFractionDigits: number = 4
): string {
  const formatter = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits,
    maximumFractionDigits,
  });
  return formatter.format(amount);
}

export function formatPercentRange(
  value: number,
  minimumFractionDigits: number = 2,
  maximumFractionDigits: number = 4
): string {
  return `${value >= 0 ? "+" : ""}${formatDecimalRange(
    value,
    minimumFractionDigits,
    maximumFractionDigits
  )}%`;
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
    timeZone: IST_TIMEZONE,
  });
}

export function formatDateShort(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: IST_TIMEZONE,
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
    timeZone: IST_TIMEZONE,
  });
}

export function getMonthName(month: number): string {
  return new Date(2024, month - 1).toLocaleString("en", { month: "long", timeZone: IST_TIMEZONE });
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

export function toDateInputValueIST(date: Date | string): string {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

export function toDateTimeInputValueIST(date: Date | string): string {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export function nowDateInputValueIST(): string {
  return toDateInputValueIST(new Date());
}

export function nowDateTimeInputValueIST(): string {
  return toDateTimeInputValueIST(new Date());
}

function parseYmd(value: string) {
  const [y, m, d] = value.split("-").map((v) => parseInt(v, 10));
  if (!y || !m || !d) return null;
  return { y, m, d };
}

export function parseDateInputAsIST(value: string): Date {
  const raw = String(value || "").trim();
  if (!raw) return new Date(NaN);
  if (/(Z|[+-]\d{2}:\d{2})$/i.test(raw)) return new Date(raw);

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const ymd = parseYmd(raw);
    if (!ymd) return new Date(raw);
    const utcMs = Date.UTC(ymd.y, ymd.m - 1, ymd.d, 0, 0, 0, 0) - IST_OFFSET_MINUTES * 60000;
    return new Date(utcMs);
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(raw)) {
    const [d, t] = raw.split("T");
    const ymd = parseYmd(d);
    if (!ymd) return new Date(raw);
    const [hh, mm, ss = "0"] = t.split(":");
    const utcMs =
      Date.UTC(
        ymd.y,
        ymd.m - 1,
        ymd.d,
        parseInt(hh || "0", 10),
        parseInt(mm || "0", 10),
        parseInt(ss || "0", 10),
        0
      ) -
      IST_OFFSET_MINUTES * 60000;
    return new Date(utcMs);
  }

  return new Date(raw);
}

export function istDayStart(value: string): Date {
  const ymd = parseYmd(value);
  if (!ymd) return new Date(value);
  const utcMs = Date.UTC(ymd.y, ymd.m - 1, ymd.d, 0, 0, 0, 0) - IST_OFFSET_MINUTES * 60000;
  return new Date(utcMs);
}

export function istDayEnd(value: string): Date {
  const ymd = parseYmd(value);
  if (!ymd) return new Date(value);
  const utcMs =
    Date.UTC(ymd.y, ymd.m - 1, ymd.d, 23, 59, 59, 999) - IST_OFFSET_MINUTES * 60000;
  return new Date(utcMs);
}
