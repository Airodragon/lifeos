"use client";

export default function AppLoading() {
  return (
    <div className="p-4 space-y-3">
      <div className="h-8 w-40 rounded-xl bg-muted animate-pulse" />
      <div className="h-28 w-full rounded-2xl bg-muted animate-pulse" />
      <div className="h-20 w-full rounded-2xl bg-muted animate-pulse" />
      <div className="h-20 w-full rounded-2xl bg-muted animate-pulse" />
    </div>
  );
}
