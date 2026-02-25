"use client";

type HapticPattern = "light" | "success" | "warning";

const PATTERNS: Record<HapticPattern, number | number[]> = {
  light: 8,
  success: [12, 24, 12],
  warning: [18, 28, 18],
};

export function triggerHaptic(pattern: HapticPattern = "light") {
  if (typeof window === "undefined") return;
  try {
    if ("vibrate" in navigator) {
      navigator.vibrate(PATTERNS[pattern]);
    }
  } catch {
    // ignore unsupported haptics
  }
}
