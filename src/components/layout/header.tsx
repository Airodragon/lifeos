"use client";

import { Bell, EyeOff, Eye } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { usePrivacy } from "@/contexts/privacy-context";

export function Header() {
  const { data: session } = useSession();
  const { privacyMode, togglePrivacy } = usePrivacy();
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
        <div className="flex items-center gap-1">
          <button
            onClick={togglePrivacy}
            className={`p-2 rounded-full transition-colors ${
              privacyMode ? "text-primary bg-primary/10" : "hover:bg-muted"
            }`}
            title={privacyMode ? "Show amounts" : "Hide amounts"}
          >
            {privacyMode ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
          <Link
            href="/notifications"
            className="relative p-2 rounded-full hover:bg-muted transition-colors"
          >
            <Bell className="w-5 h-5" />
          </Link>
          <Link
            href="/settings"
            className="relative w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold hover:bg-primary/20 transition-colors"
            title="Profile & settings"
          >
            {name.slice(0, 1).toUpperCase()}
          </Link>
        </div>
      </div>
    </header>
  );
}
