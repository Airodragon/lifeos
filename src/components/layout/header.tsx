"use client";

import { Bell, EyeOff, Eye, Search, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { usePrivacy } from "@/contexts/privacy-context";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { trackRecentPage } from "@/lib/ui-preferences";

export function Header() {
  const { data: session } = useSession();
  const { privacyMode, togglePrivacy } = usePrivacy();
  const pathname = usePathname();
  const router = useRouter();
  const name = session?.user?.name || "User";
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState("");
  const entries = useMemo(
    () => [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Expenses", href: "/expenses" },
      { label: "Monthly", href: "/monthly" },
      { label: "Accounts", href: "/accounts" },
      { label: "Budgets", href: "/budgets" },
      { label: "Net Worth", href: "/net-worth" },
      { label: "Investments", href: "/investments" },
      { label: "Goal Investing", href: "/goal-investing" },
      { label: "Rebalance", href: "/rebalance" },
      { label: "Tax Center", href: "/tax-center" },
      { label: "Fixed Deposits", href: "/fixed-deposits" },
      { label: "Offline Assets", href: "/offline-assets" },
      { label: "SIP Manager", href: "/sips" },
      { label: "Subscriptions", href: "/subscriptions" },
      { label: "Committees", href: "/committees" },
      { label: "EMI Tracker", href: "/emi-tracker" },
      { label: "Goals", href: "/goals" },
      { label: "Analytics", href: "/analytics" },
      { label: "Recommendations", href: "/recommendations" },
      { label: "Notifications", href: "/notifications" },
      { label: "More", href: "/more" },
      { label: "Settings", href: "/settings" },
    ],
    []
  );
  const results = entries.filter((entry) =>
    query.trim() ? entry.label.toLowerCase().includes(query.trim().toLowerCase()) : true
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setShowSearch(true);
      }
      if (event.key === "Escape") {
        setShowSearch(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const route = entries.find((entry) => pathname === entry.href || pathname.startsWith(`${entry.href}/`));
    if (route) trackRecentPage(route.href, route.label);
  }, [entries, pathname]);

  const showBack = !["/dashboard", "/expenses", "/monthly", "/more"].some(
    (root) => pathname === root || pathname.startsWith(`${root}/`)
  );

  return (
    <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/30 pt-[env(safe-area-inset-top)]">
      <div className="flex items-center justify-between px-4 h-14 max-w-2xl mx-auto">
        <div className="flex items-center gap-1.5">
          {showBack && (
            <button
              onClick={() => router.back()}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              aria-label="Go back"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          <div>
          <p suppressHydrationWarning className="text-xs text-muted-foreground">{greeting}</p>
          <h1 className="text-base font-semibold -mt-0.5">{name}</h1>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSearch(true)}
            className="p-2 rounded-full hover:bg-muted transition-colors"
            title="Search (Cmd/Ctrl+K)"
          >
            <Search className="w-5 h-5" />
          </button>
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
        </div>
      </div>
      {showSearch && (
        <div className="absolute inset-x-0 top-14 z-50 border-b border-border/40 bg-background/95 backdrop-blur-xl">
          <div className="max-w-2xl mx-auto p-3 space-y-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search pages..."
              className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm"
            />
            <div className="max-h-56 overflow-auto space-y-1">
              {results.map((entry) => (
                <Link
                  key={entry.href}
                  href={entry.href}
                  onClick={() => {
                    setShowSearch(false);
                    setQuery("");
                  }}
                  className="block rounded-lg px-2.5 py-2 text-sm hover:bg-muted"
                >
                  {entry.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
