"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";

export function Header() {
  const { data: session } = useSession();
  const name = session?.user?.name || "User";
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/30">
      <div className="flex items-center justify-between px-4 h-14 max-w-2xl mx-auto">
        <div>
          <p className="text-xs text-muted-foreground">{greeting}</p>
          <h1 className="text-base font-semibold -mt-0.5">{name}</h1>
        </div>
        <Link
          href="/notifications"
          className="relative p-2 rounded-full hover:bg-muted transition-colors"
        >
          <Bell className="w-5 h-5" />
        </Link>
      </div>
    </header>
  );
}
