"use client";

import { useEffect } from "react";

function base64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function PushBootstrap() {
  useEffect(() => {
    const initPush = async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
      const permission = Notification.permission;
      if (permission === "denied") return;
      try {
        const reg = await navigator.serviceWorker.register("/push-sw.js");
        if (permission !== "granted") return;

        const keyRes = await fetch("/api/push/subscribe");
        const keyData = await keyRes.json();
        const publicKey = String(keyData?.publicKey || "");
        if (!publicKey) return;

        const existing = await reg.pushManager.getSubscription();
        const sub =
          existing ||
          (await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: base64ToUint8Array(publicKey),
          }));

        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sub),
        });
      } catch {
        // ignore push init failures
      }
    };
    initPush();
  }, []);

  return null;
}
