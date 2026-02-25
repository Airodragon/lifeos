"use client";

const RECENT_PAGES_KEY = "lifeos-recent-pages";
const DISMISSED_INSTALL_PROMPT_KEY = "lifeos-install-prompt-dismissed";

export interface RecentPageItem {
  href: string;
  label: string;
  at: string;
}

export function readRecentPages(): RecentPageItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_PAGES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (row) =>
        row &&
        typeof row.href === "string" &&
        typeof row.label === "string" &&
        typeof row.at === "string"
    );
  } catch {
    return [];
  }
}

export function trackRecentPage(href: string, label: string) {
  if (typeof window === "undefined") return;
  try {
    const current = readRecentPages().filter((row) => row.href !== href);
    const next: RecentPageItem[] = [
      { href, label, at: new Date().toISOString() },
      ...current,
    ].slice(0, 6);
    localStorage.setItem(RECENT_PAGES_KEY, JSON.stringify(next));
  } catch {
    // ignore storage failures
  }
}

export function isInstallPromptDismissed() {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(DISMISSED_INSTALL_PROMPT_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissInstallPrompt() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DISMISSED_INSTALL_PROMPT_KEY, "1");
  } catch {
    // ignore storage failures
  }
}
