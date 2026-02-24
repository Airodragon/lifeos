"use client";

export default function RootLoading() {
  return (
    <div className="min-h-svh bg-background p-4">
      <div className="mx-auto max-w-2xl space-y-3">
        <div className="h-8 w-48 rounded-xl bg-muted animate-pulse" />
        <div className="h-28 w-full rounded-2xl bg-muted animate-pulse" />
        <div className="h-20 w-full rounded-2xl bg-muted animate-pulse" />
      </div>
    </div>
  );
}
