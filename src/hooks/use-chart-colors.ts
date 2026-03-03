"use client";

import { useEffect, useState } from "react";

/**
 * Reads a CSS custom property value from the document root.
 * Falls back to the provided fallback color when the DOM is unavailable (SSR).
 */
function getCssVar(name: string, fallback = "#3b82f6"): string {
  if (typeof window === "undefined") return fallback;
  const val = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  if (!val) return fallback;
  // CSS vars like `217 91% 60%` (HSL components) need wrapping
  if (/^\d/.test(val)) return `hsl(${val})`;
  return val;
}

/** Semantic color tokens used by charts */
export interface ChartColors {
  primary: string;
  success: string;
  destructive: string;
  warning: string;
  muted: string;
  border: string;
  mutedForeground: string;
}

/** Returns live chart colors that update when the theme changes. */
export function useChartColors(): ChartColors {
  const [colors, setColors] = useState<ChartColors>(() => ({
    primary: "#3b82f6",
    success: "#22c55e",
    destructive: "#ef4444",
    warning: "#f97316",
    muted: "#f1f5f9",
    border: "#e2e8f0",
    mutedForeground: "#94a3b8",
  }));

  useEffect(() => {
    const update = () => {
      setColors({
        primary: getCssVar("--primary", "#3b82f6"),
        success: getCssVar("--success", "#22c55e"),
        destructive: getCssVar("--destructive", "#ef4444"),
        warning: getCssVar("--warning", "#f97316"),
        muted: getCssVar("--muted", "#f1f5f9"),
        border: getCssVar("--border", "#e2e8f0"),
        mutedForeground: getCssVar("--muted-foreground", "#94a3b8"),
      });
    };

    update();

    // Re-read on system theme changes
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", update);

    // Re-read when the html class changes (manual toggle)
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });

    return () => {
      mq.removeEventListener("change", update);
      observer.disconnect();
    };
  }, []);

  return colors;
}
