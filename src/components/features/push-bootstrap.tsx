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

function isStandaloneMode() {
  if (typeof window === "undefined") return false;
  const iosStandalone = Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
  const mediaStandalone = window.matchMedia?.("(display-mode: standalone)")?.matches ?? false;
  return iosStandalone || mediaStandalone;
}

function isAppleMobile() {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function canUseWebPush() {
  if (typeof window === "undefined") return { ok: false, reason: "Not in browser" };
  if (!("Notification" in window)) return { ok: false, reason: "Notifications not supported" };
  if (!("serviceWorker" in navigator)) return { ok: false, reason: "Service worker not supported" };
  if (!("PushManager" in window)) return { ok: false, reason: "Push API not supported" };
  if (isAppleMobile() && !isStandaloneMode()) {
    return { ok: false, reason: "Install app from Safari to enable iOS notifications" };
  }
  return { ok: true as const };
}

export async function subscribeForPush(askPermission: boolean) {
  const support = canUseWebPush();
  if (!support.ok) return support;

  let permission = Notification.permission;
  if (askPermission && permission !== "granted") {
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") {
    return { ok: false as const, reason: "Notification permission not granted" };
  }

  try {
    const reg = await navigator.serviceWorker.register("/push-sw.js");
    const keyRes = await fetch("/api/push/subscribe");
    const keyData = await keyRes.json();
    const publicKey = String(keyData?.publicKey || "");
    if (!publicKey) return { ok: false as const, reason: "VAPID public key missing" };

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

    return { ok: true as const };
  } catch {
    return { ok: false as const, reason: "Failed to register push subscription" };
  }
}

export function PushBootstrap() {
  useEffect(() => {
    const initPush = async () => {
      if (typeof window === "undefined" || Notification.permission !== "granted") return;
      await subscribeForPush(false);
    };
    initPush();
  }, []);

  return null;
}
