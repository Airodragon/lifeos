"use client";

import { useCallback } from "react";
import { usePrivacy } from "@/contexts/privacy-context";
import { formatCurrency as rawFormatCurrency, formatPercent as rawFormatPercent } from "@/lib/utils";

const MASK = "••••";

export function useFormat() {
  const { privacyMode } = usePrivacy();

  const fc = useCallback(
    (amount: number, currency: string = "INR", compact: boolean = false) => {
      if (privacyMode) {
        const symbol = currency === "INR" ? "₹" : "$";
        return `${symbol}${MASK}`;
      }
      return rawFormatCurrency(amount, currency, compact);
    },
    [privacyMode]
  );

  const fp = useCallback(
    (value: number, digits: number = 1) => {
      if (privacyMode) return `${MASK}%`;
      return rawFormatPercent(value, digits);
    },
    [privacyMode]
  );

  return { fc, fp, privacyMode };
}
