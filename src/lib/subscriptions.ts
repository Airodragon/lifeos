import { parseDateInputAsIST, toDateInputValueIST } from "@/lib/utils";

export const SUBSCRIPTION_CADENCES = ["monthly", "yearly", "one_time"] as const;
export type SubscriptionCadence = (typeof SUBSCRIPTION_CADENCES)[number];

export function normalizeCadence(value: string): SubscriptionCadence {
  const v = String(value || "").toLowerCase().trim();
  if (v === "monthly" || v === "yearly" || v === "one_time") return v;
  throw new Error("Invalid cadence");
}

export function parseDueDateInput(value: string): Date {
  return parseDateInputAsIST(value);
}

export function getDueDateKey(date: Date | string): string {
  return toDateInputValueIST(date);
}

export function shiftDueDate(current: Date, cadence: SubscriptionCadence): Date {
  const next = new Date(current);
  if (cadence === "monthly") {
    next.setMonth(next.getMonth() + 1);
    return next;
  }
  if (cadence === "yearly") {
    next.setFullYear(next.getFullYear() + 1);
    return next;
  }
  return next;
}

export function computeNextDueAfterPayment(
  currentDueDate: Date,
  cadence: SubscriptionCadence,
  now = new Date()
): Date {
  if (cadence === "one_time") return currentDueDate;
  let next = shiftDueDate(currentDueDate, cadence);
  const maxIterations = 24;
  let i = 0;
  while (next <= now && i < maxIterations) {
    next = shiftDueDate(next, cadence);
    i++;
  }
  return next;
}
