"use client";

import { useCallback } from "react";
import { usePrivacy } from "@/contexts/privacy-context";
import {
  formatCompactIndianCurrency as rawFormatCompactIndianCurrency,
  formatCurrency as rawFormatCurrency,
  formatCurrencyRange as rawFormatCurrencyRange,
  formatDecimalRange as rawFormatDecimalRange,
  formatPercent as rawFormatPercent,
  formatPercentRange as rawFormatPercentRange,
} from "@/lib/utils";

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

  const fcr = useCallback(
    (
      amount: number,
      currency: string = "INR",
      minimumFractionDigits: number = 2,
      maximumFractionDigits: number = 4
    ) => {
      if (privacyMode) {
        const symbol = currency === "INR" ? "₹" : "$";
        return `${symbol}${MASK}`;
      }
      return rawFormatCurrencyRange(
        amount,
        currency,
        minimumFractionDigits,
        maximumFractionDigits
      );
    },
    [privacyMode]
  );

  const fdr = useCallback(
    (
      value: number,
      minimumFractionDigits: number = 2,
      maximumFractionDigits: number = 4
    ) => {
      if (privacyMode) return MASK;
      return rawFormatDecimalRange(value, minimumFractionDigits, maximumFractionDigits);
    },
    [privacyMode]
  );

  const fpr = useCallback(
    (
      value: number,
      minimumFractionDigits: number = 2,
      maximumFractionDigits: number = 4
    ) => {
      if (privacyMode) return `${MASK}%`;
      return rawFormatPercentRange(value, minimumFractionDigits, maximumFractionDigits);
    },
    [privacyMode]
  );

  const fic = useCallback(
    (amount: number, currency: string = "INR") => {
      if (privacyMode) {
        const symbol = currency === "INR" ? "₹" : "$";
        return `${symbol}${MASK}`;
      }
      return rawFormatCompactIndianCurrency(amount, currency);
    },
    [privacyMode]
  );

  return { fc, fp, fic, fcr, fdr, fpr, privacyMode };
}
