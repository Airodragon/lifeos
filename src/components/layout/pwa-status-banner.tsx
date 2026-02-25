"use client";

import { useEffect, useMemo, useState } from "react";
import { CloudOff, CloudCheck, Download, X } from "lucide-react";
import { readLastSyncAt } from "@/lib/sync-status";
import { getRelativeTime } from "@/lib/utils";
import { dismissInstallPrompt, isInstallPromptDismissed } from "@/lib/ui-preferences";

function isStandaloneMode() {
  if (typeof window === "undefined") return false;
  const iosStandalone = Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
  const mediaStandalone = window.matchMedia?.("(display-mode: standalone)")?.matches ?? false;
  return iosStandalone || mediaStandalone;
}

export function PWAStatusBanner() {
  const [online, setOnline] = useState(
    typeof window === "undefined" ? true : navigator.onLine
  );
  const [standalone, setStandalone] = useState(
    typeof window === "undefined" ? false : isStandaloneMode()
  );
  const [lastSync, setLastSync] = useState<Date | null>(readLastSyncAt);
  const [showInstallNudge, setShowInstallNudge] = useState(() => {
    if (typeof window === "undefined") return false;
    const mobileLike = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    return !isStandaloneMode() && mobileLike && !isInstallPromptDismissed();
  });

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const media = window.matchMedia?.("(display-mode: standalone)");
    const onDisplayMode = () => setStandalone(isStandaloneMode());
    media?.addEventListener?.("change", onDisplayMode);

    const timer = window.setInterval(() => {
      setLastSync(readLastSyncAt());
    }, 15000);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      media?.removeEventListener?.("change", onDisplayMode);
      window.clearInterval(timer);
    };
  }, []);

  const syncLabel = useMemo(() => {
    if (!lastSync) return "No refresh yet";
    return `Last refresh ${getRelativeTime(lastSync)}`;
  }, [lastSync]);

  if (!standalone && !showInstallNudge) return null;

  return (
    <>
      {showInstallNudge && !standalone && (
        <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 border-b border-primary/20 bg-primary/10 px-4 py-1.5 text-xs">
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-primary">
              <Download className="w-3.5 h-3.5" />
              Install LifeOS from browser menu for a full-screen app.
            </span>
            <button
              onClick={() => {
                dismissInstallPrompt();
                setShowInstallNudge(false);
              }}
              className="p-1 rounded hover:bg-primary/15"
              aria-label="Dismiss install hint"
            >
              <X className="w-3.5 h-3.5 text-primary" />
            </button>
          </div>
        </div>
      )}
      {standalone && (
        <div
          className={`sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 border-b px-4 py-1.5 text-xs ${
            online
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-orange-500/20 bg-orange-500/10 text-orange-700 dark:text-orange-300"
          }`}
        >
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5">
              {online ? <CloudCheck className="w-3.5 h-3.5" /> : <CloudOff className="w-3.5 h-3.5" />}
              {online ? "Online mode" : "Offline mode"}
            </span>
            <span className="text-muted-foreground">{syncLabel}</span>
          </div>
        </div>
      )}
    </>
  );
}

