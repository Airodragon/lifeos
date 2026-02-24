"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Landmark,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/money", label: "Money", icon: Landmark },
  { href: "/wealth", label: "Wealth", icon: TrendingUp },
];

const moneyPages = [
  "/money",
  "/expenses",
  "/accounts",
  "/monthly",
  "/budgets",
  "/notifications",
];
const wealthPages = [
  "/wealth",
  "/investments",
  "/goal-investing",
  "/rebalance",
  "/tax-center",
  "/offline-assets",
  "/fixed-deposits",
  "/net-worth",
  "/goals",
  "/liabilities",
];

export function BottomNav() {
  const pathname = usePathname();
  const isMoneyActive = moneyPages.some((p) => pathname.startsWith(p));
  const isWealthActive = wealthPages.some((p) => pathname.startsWith(p));

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/50 bg-card/80 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-14 max-w-2xl mx-auto px-2">
        {navItems.map((item) => {
          const isActive =
            item.href === "/money"
              ? isMoneyActive
              : item.href === "/wealth"
                ? isWealthActive
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
  );
}
