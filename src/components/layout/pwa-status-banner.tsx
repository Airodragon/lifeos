"use client";

import { useEffect, useMemo, useState } from "react";
import { CloudOff, CloudCheck } from "lucide-react";
import { readLastSyncAt } from "@/lib/sync-status";
import { getRelativeTime } from "@/lib/utils";

function isStandaloneMode() {
  if (typeof window === "undefined") return false;
  const iosStandalone = Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
  const mediaStandalone = window.matchMedia?.("(display-mode: standalone)")?.matches ?? false;
  return iosStandalone || mediaStandalone;
}

export function PWAStatusBanner() {
  const [online, setOnline] = useState(true);
  const [standalone, setStandalone] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  useEffect(() => {
    setOnline(navigator.onLine);
    setStandalone(isStandaloneMode());
    setLastSync(readLastSyncAt());

    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    const timer = window.setInterval(() => {
      setLastSync(readLastSyncAt());
    }, 15000);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.clearInterval(timer);
    };
  }, []);

  const syncLabel = useMemo(() => {
    if (!lastSync) return "Never synced";
    return `Synced ${getRelativeTime(lastSync)}`;
  }, [lastSync]);

  if (!standalone) return null;

  return (
    <div
      className={`sticky top-14 z-20 border-b px-4 py-1.5 text-[11px] ${
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
  );
}

