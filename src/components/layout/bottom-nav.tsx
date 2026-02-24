"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Receipt,
  Plus,
  CalendarDays,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { QuickAddSheet } from "@/components/features/quick-add-sheet";

const navItems = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "#add", label: "Add", icon: Plus, isAdd: true },
  { href: "/monthly", label: "Monthly", icon: CalendarDays },
  { href: "/more", label: "More", icon: Menu },
];

const morePages = [
  "/accounts",
  "/fixed-deposits",
  "/investments",
  "/offline-assets",
  "/committees",
  "/goals",
  "/emi-tracker",
  "/budgets",
  "/net-worth",
  "/analytics",
  "/recommendations",
  "/goal-investing",
  "/rebalance",
  "/tax-center",
  "/sips",
  "/notifications",
  "/settings",
  "/onboarding",
];

export function BottomNav() {
  const pathname = usePathname();
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const isMoreActive = morePages.some((p) => pathname.startsWith(p));

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/50 bg-card/80 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around h-14 max-w-2xl mx-auto px-2">
          {navItems.map((item) => {
            if (item.isAdd) {
              return (
                <button
                  key="add"
                  onClick={() => setShowQuickAdd(true)}
                  className="flex items-center justify-center -mt-5"
                >
                  <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg active:scale-95 transition-transform">
                    <Plus className="w-6 h-6" />
                  </div>
                </button>
              );
            }

            const isActive =
              item.href === "/more"
                ? isMoreActive
                : pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1 relative min-w-[48px]",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="bottomNav"
                    className="absolute -top-1 w-5 h-0.5 rounded-full bg-primary"
                    transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                  />
                )}
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <QuickAddSheet
        open={showQuickAdd}
        onClose={() => setShowQuickAdd(false)}
        contextPath={pathname}
      />
    </>
  );
}
