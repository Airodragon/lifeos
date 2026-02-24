"use client";

import Link from "next/link";
import {
  Landmark,
  TrendingUp,
  Building2,
  Users,
  Target,
  PiggyBank,
  BarChart3,
  LineChart,
  Bell,
  Settings,
  ChevronRight,
  ArrowUpRight,
  BadgeDollarSign,
  ShieldCheck,
  Scale,
  ReceiptText,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const sections = [
  {
    title: "Money",
    items: [
      { href: "/accounts", icon: Landmark, label: "Accounts", desc: "Bank & cash balances", color: "bg-blue-500/10 text-blue-500" },
      { href: "/sips", icon: ArrowUpRight, label: "SIP Manager", desc: "Track & manage SIPs", color: "bg-emerald-500/10 text-emerald-500" },
      { href: "/fixed-deposits", icon: BadgeDollarSign, label: "Fixed Deposits", desc: "FDs with auto interest calc", color: "bg-teal-500/10 text-teal-500" },
      { href: "/investments", icon: TrendingUp, label: "Investments", desc: "Stocks, ETFs, crypto", color: "bg-violet-500/10 text-violet-500" },
      { href: "/offline-assets", icon: Building2, label: "Offline Assets", desc: "Real estate, gold", color: "bg-amber-500/10 text-amber-500" },
    ],
  },
  {
    title: "Planning",
    items: [
      { href: "/budgets", icon: PiggyBank, label: "Budgets", desc: "Monthly limits", color: "bg-pink-500/10 text-pink-500" },
      { href: "/goals", icon: Target, label: "Goals", desc: "Financial targets", color: "bg-cyan-500/10 text-cyan-500" },
      { href: "/committees", icon: Users, label: "Committees", desc: "Chit fund tracking", color: "bg-orange-500/10 text-orange-500" },
      { href: "/net-worth", icon: BarChart3, label: "Net Worth", desc: "Assets vs liabilities", color: "bg-indigo-500/10 text-indigo-500" },
    ],
  },
  {
    title: "Insights",
    items: [
      { href: "/analytics", icon: LineChart, label: "Analytics", desc: "Trends & reports", color: "bg-sky-500/10 text-sky-500" },
      { href: "/goal-investing", icon: Target, label: "Goal Investing", desc: "Goal-wise SIP planning", color: "bg-cyan-500/10 text-cyan-500" },
      { href: "/rebalance", icon: Scale, label: "Rebalance Assistant", desc: "Allocation drift suggestions", color: "bg-indigo-500/10 text-indigo-500" },
      { href: "/tax-center", icon: ReceiptText, label: "Tax Center", desc: "STCG/LTCG estimate", color: "bg-amber-500/10 text-amber-500" },
      { href: "/notifications", icon: Bell, label: "Notifications", desc: "Alerts & reminders", color: "bg-rose-500/10 text-rose-500" },
      { href: "/notifications#alerts-engine", icon: ShieldCheck, label: "Alerts Engine", desc: "Configure smart alerts", color: "bg-emerald-500/10 text-emerald-500" },
      { href: "/settings", icon: Settings, label: "Settings", desc: "Profile & preferences", color: "bg-gray-500/10 text-gray-500" },
    ],
  },
];

export default function MorePage() {
  return (
    <div className="p-4 space-y-5 pb-6">
      <h2 className="text-lg font-semibold">More</h2>
      {sections.map((section) => (
        <div key={section.title}>
          <p className="text-xs text-muted-foreground font-medium mb-2 px-1">{section.title}</p>
          <Card>
            <CardContent className="p-0 divide-y divide-border/40">
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-3 p-3.5 hover:bg-muted/50 transition-colors"
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${item.color}`}>
                      <Icon className="w-4.5 h-4.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </Link>
                );
              })}
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  );
}
