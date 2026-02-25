"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Target,
  PiggyBank,
  ChevronRight,
  Landmark,
  CreditCard,
  Plus,
  BarChart3,
  BellRing,
  SlidersHorizontal,
  Download,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProgressRing } from "@/components/charts/progress-ring";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { LineChart } from "@/components/charts/line-chart";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate, getRelativeTime, toDecimal } from "@/lib/utils";
import { useFormat } from "@/hooks/use-format";
import { markDataSynced } from "@/lib/sync-status";
import { triggerHaptic } from "@/lib/haptics";

interface DashboardData {
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  breakdown: {
    bankAccounts: number;
    investments: number;
    investmentCost: number;
    investmentGain: number;
    offlineAssets: number;
  };
}

interface Transaction {
  id: string;
  amount: string;
  type: string;
  description: string | null;
  date: string;
  category: { name: string; icon: string | null; color: string | null } | null;
}

interface Goal {
  id: string;
  name: string;
  targetAmount: string;
  currentAmount: string;
  deadline: string | null;
  color: string | null;
  icon: string | null;
}

interface Account {
  id: string;
  name: string;
  type: string;
  balance: string;
  color: string | null;
}

interface AIInsights {
  summary: string;
  suggestions: string[];
  alerts: string[];
  opportunities: string[];
}

interface LayerInsights {
  concentration: Array<{
    symbol: string;
    name: string;
    type: string;
    value: number;
    weight: number;
    riskLevel: "low" | "medium" | "high";
  }>;
  anomalies: Array<{
    category: string;
    current: number;
    baseline: number;
    jumpPercent: number;
  }>;
}

interface WatchQuote {
  symbol: string;
  price: number;
}

interface Liability {
  id: string;
  name: string;
  emiAmount: string | null;
  startDate: string;
}

interface Subscription {
  id: string;
  name: string;
  nextDueDate: string;
  remindDaysBefore: number;
  active: boolean;
}

interface Committee {
  id: string;
  name: string;
  paymentDay: number;
  status: string;
  payments: Array<{
    id: string;
    month: number;
    paid: boolean;
    amount: string | null;
  }>;
}

interface DueNudge {
  id: string;
  label: string;
  subLabel: string;
  dueText: string;
  href: string;
  urgency: number;
}

interface DashboardSnapshot {
  netWorthData: DashboardData | null;
  transactions: Transaction[];
  goals: Goal[];
  accounts: Account[];
  aiInsights: AIInsights | null;
  layerInsights: LayerInsights | null;
  dueNudges: DueNudge[];
  monthExpense: number;
  monthIncome: number;
  cachedAt: string;
}

type SectionKey =
  | "dueSoon"
  | "watchlist"
  | "timeline"
  | "goals"
  | "transactions"
  | "ai"
  | "risk";

type SectionPrefs = Record<SectionKey, boolean>;

const DASHBOARD_SNAPSHOT_KEY = "lifeos-dashboard-snapshot-v1";
const DASHBOARD_SECTION_PREFS_KEY = "lifeos-dashboard-section-prefs-v1";

const defaultSectionPrefs: SectionPrefs = {
  dueSoon: true,
  watchlist: true,
  timeline: true,
  goals: true,
  transactions: true,
  ai: true,
  risk: true,
};

const ACCOUNT_ICONS: Record<string, typeof Landmark> = {
  bank: Landmark,
  savings: PiggyBank,
  credit_card: CreditCard,
  wallet: Wallet,
  cash: Wallet,
};

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

function dayDiffFromDate(dateString: string) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const due = new Date(dateString);
  const dueDate = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  return Math.round((dueDate.getTime() - today.getTime()) / 86400000);
}

function daysUntilDayOfMonth(dayOfMonth: number) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const safeDayThisMonth = Math.min(
    dayOfMonth,
    new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  );
  let nextDue = new Date(now.getFullYear(), now.getMonth(), safeDayThisMonth);
  if (nextDue.getTime() < today.getTime()) {
    const safeDayNextMonth = Math.min(
      dayOfMonth,
      new Date(now.getFullYear(), now.getMonth() + 2, 0).getDate()
    );
    nextDue = new Date(now.getFullYear(), now.getMonth() + 1, safeDayNextMonth);
  }
  return Math.round((nextDue.getTime() - today.getTime()) / 86400000);
}

function formatDueText(days: number) {
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  return `Due in ${days}d`;
}

function readDashboardSnapshot(): DashboardSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DASHBOARD_SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DashboardSnapshot;
    if (!parsed || !parsed.cachedAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeDashboardSnapshot(snapshot: DashboardSnapshot) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DASHBOARD_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    // ignore storage failures
  }
}

function readSectionPrefs(): SectionPrefs {
  if (typeof window === "undefined") return defaultSectionPrefs;
  try {
    const raw = localStorage.getItem(DASHBOARD_SECTION_PREFS_KEY);
    if (!raw) return defaultSectionPrefs;
    const parsed = JSON.parse(raw) as Partial<SectionPrefs>;
    return { ...defaultSectionPrefs, ...parsed };
  } catch {
    return defaultSectionPrefs;
  }
}

function writeSectionPrefs(prefs: SectionPrefs) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DASHBOARD_SECTION_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // ignore storage failures
  }
}

export default function DashboardPage() {
  const { fc: formatCurrency } = useFormat();
  const [netWorthData, setNetWorthData] = useState<DashboardData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [aiInsights, setAiInsights] = useState<AIInsights | null>(null);
  const [layerInsights, setLayerInsights] = useState<LayerInsights | null>(null);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [watchInput, setWatchInput] = useState("");
  const [watchQuotes, setWatchQuotes] = useState<WatchQuote[]>([]);
  const [dueNudges, setDueNudges] = useState<DueNudge[]>([]);
  const [monthExpense, setMonthExpense] = useState(0);
  const [monthIncome, setMonthIncome] = useState(0);
  const [showCustomize, setShowCustomize] = useState(false);
  const [sectionPrefs, setSectionPrefs] = useState<SectionPrefs>(readSectionPrefs);
  const [offlineSnapshotAt, setOfflineSnapshotAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    Promise.all([
      fetch("/api/net-worth").then((r) => r.json()),
      fetch("/api/transactions?limit=5").then((r) => r.json()),
      fetch(`/api/transactions?limit=300&startDate=${encodeURIComponent(monthStart)}`).then((r) => r.json()),
      fetch("/api/goals").then((r) => r.json()),
      fetch("/api/accounts").then((r) => r.json()),
      fetch("/api/liabilities").then((r) => r.json()).catch(() => []),
      fetch("/api/subscriptions?status=active").then((r) => r.json()).catch(() => []),
      fetch("/api/committees").then((r) => r.json()).catch(() => []),
      fetch("/api/ai/insights").then((r) => r.json()).catch(() => null),
      fetch("/api/insights/layer").then((r) => r.json()).catch(() => null),
    ]).then(([nw, txn, monthTxn, g, acc, liabilitiesData, subscriptionsData, committeesData, ai, layer]) => {
      setNetWorthData(nw);
      setTransactions(txn.transactions || []);
      const monthlyRows = monthTxn.transactions || [];
      setMonthExpense(
        monthlyRows
          .filter((t: Transaction) => t.type === "expense")
          .reduce((sum: number, t: Transaction) => sum + toDecimal(t.amount), 0)
      );
      setMonthIncome(
        monthlyRows
          .filter((t: Transaction) => t.type === "income")
          .reduce((sum: number, t: Transaction) => sum + toDecimal(t.amount), 0)
      );
      setGoals(g || []);
      setAccounts(acc || []);
      const goalRows = Array.isArray(g) ? g : [];
      const liabilities = Array.isArray(liabilitiesData) ? (liabilitiesData as Liability[]) : [];
      const subscriptions = Array.isArray(subscriptionsData)
        ? (subscriptionsData as Subscription[])
        : [];
      const committees = Array.isArray(committeesData) ? (committeesData as Committee[]) : [];
      const dueSoonRows: DueNudge[] = [];

      liabilities
        .filter((item) => toDecimal(item.emiAmount) > 0)
        .forEach((item) => {
          const dueDay = new Date(item.startDate).getDate();
          const days = daysUntilDayOfMonth(dueDay);
          if (days <= 7) {
            dueSoonRows.push({
              id: `emi-${item.id}`,
              label: item.name,
              subLabel: "EMI",
              dueText: formatDueText(days),
              href: "/emi-tracker",
              urgency: days,
            });
          }
        });

      subscriptions
        .filter((item) => item.active)
        .forEach((item) => {
          const days = dayDiffFromDate(item.nextDueDate);
          const threshold = Math.max(item.remindDaysBefore || 0, 3);
          if (days <= threshold) {
            dueSoonRows.push({
              id: `sub-${item.id}`,
              label: item.name,
              subLabel: "Subscription",
              dueText: formatDueText(days),
              href: "/subscriptions",
              urgency: days,
            });
          }
        });

      committees
        .filter((item) => item.status === "active")
        .forEach((item) => {
          const nextUnpaid = item.payments.find((payment) => !payment.paid);
          if (!nextUnpaid) return;
          const days = daysUntilDayOfMonth(item.paymentDay || 1);
          if (days <= 7) {
            dueSoonRows.push({
              id: `committee-${item.id}`,
              label: item.name,
              subLabel: `Committee month ${nextUnpaid.month}`,
              dueText: formatDueText(days),
              href: "/committees",
              urgency: days,
            });
          }
        });

      goalRows.forEach((item: Goal) => {
        if (!item.deadline) return;
        const target = toDecimal(item.targetAmount);
        const current = toDecimal(item.currentAmount);
        if (current >= target) return;
        const days = dayDiffFromDate(item.deadline);
        if (days <= 30) {
          dueSoonRows.push({
            id: `goal-${item.id}`,
            label: item.name,
            subLabel: "Goal deadline",
            dueText: formatDueText(days),
            href: "/goals",
            urgency: days,
          });
        }
      });

      setDueNudges(
        dueSoonRows
          .sort((a, b) => a.urgency - b.urgency)
          .slice(0, 6)
      );
      if (ai && !ai.error) setAiInsights(ai);
      if (layer && !layer.error) setLayerInsights(layer);
      writeDashboardSnapshot({
        netWorthData: nw,
        transactions: txn.transactions || [],
        goals: g || [],
        accounts: acc || [],
        aiInsights: ai && !ai.error ? ai : null,
        layerInsights: layer && !layer.error ? layer : null,
        dueNudges: dueSoonRows.sort((a, b) => a.urgency - b.urgency).slice(0, 6),
        monthExpense: monthlyRows
          .filter((t: Transaction) => t.type === "expense")
          .reduce((sum: number, t: Transaction) => sum + toDecimal(t.amount), 0),
        monthIncome: monthlyRows
          .filter((t: Transaction) => t.type === "income")
          .reduce((sum: number, t: Transaction) => sum + toDecimal(t.amount), 0),
        cachedAt: new Date().toISOString(),
      });
      markDataSynced();
      setLoading(false);
    }).catch(() => {
      const snapshot = readDashboardSnapshot();
      if (snapshot) {
        setNetWorthData(snapshot.netWorthData);
        setTransactions(snapshot.transactions || []);
        setGoals(snapshot.goals || []);
        setAccounts(snapshot.accounts || []);
        setAiInsights(snapshot.aiInsights || null);
        setLayerInsights(snapshot.layerInsights || null);
        setDueNudges(snapshot.dueNudges || []);
        setMonthExpense(snapshot.monthExpense || 0);
        setMonthIncome(snapshot.monthIncome || 0);
        setOfflineSnapshotAt(new Date(snapshot.cachedAt));
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    fetch("/api/watchlist")
      .then((r) => r.json())
      .then((rows) => {
        if (Array.isArray(rows)) setWatchlist(rows.slice(0, 10));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!watchlist.length) return;
    fetch("/api/market-data/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbols: watchlist }),
    })
      .then((r) => r.json())
      .then((data) => {
        const rows = watchlist.map((symbol) => ({
          symbol,
          price: Number(data?.[symbol] || 0),
        }));
        setWatchQuotes(rows);
      })
      .catch(() => {});
  }, [watchlist]);

  const addWatchlistSymbol = async () => {
    const symbol = watchInput.trim().toUpperCase();
    if (!symbol) return;
    if (watchlist.includes(symbol)) return;
    if (watchlist.length >= 10) return;
    const res = await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol }),
    });
    if (!res.ok) return;
    const next = [...watchlist, symbol].slice(0, 10);
    setWatchlist(next);
    setWatchInput("");
    triggerHaptic("success");
  };

  const removeWatchlistSymbol = async (symbol: string) => {
    await fetch(`/api/watchlist?symbol=${encodeURIComponent(symbol)}`, {
      method: "DELETE",
    });
    const next = watchlist.filter((s) => s !== symbol);
    setWatchlist(next);
    setWatchQuotes((prev) => prev.filter((row) => row.symbol !== symbol));
    triggerHaptic("light");
  };

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-36 w-full" />
      </div>
    );
  }

  const nw = netWorthData;
  const investGain = nw?.breakdown.investmentGain || 0;
  const investGainPercent = nw?.breakdown.investmentCost
    ? (investGain / nw.breakdown.investmentCost) * 100
    : 0;
  const savingsRate = monthIncome > 0 ? ((monthIncome - monthExpense) / monthIncome) * 100 : 0;
  const netWorthTrend = [
    { month: "M-2", NetWorth: (nw?.netWorth || 0) * 0.94 },
    { month: "M-1", NetWorth: (nw?.netWorth || 0) * 0.98 },
    { month: "Now", NetWorth: nw?.netWorth || 0 },
  ];
  const hiddenCount = Object.values(sectionPrefs).filter((isVisible) => !isVisible).length;
  const offlineSnapshotLabel = offlineSnapshotAt
    ? `Showing offline snapshot from ${getRelativeTime(offlineSnapshotAt)}`
    : null;

  const updateSectionPref = (key: SectionKey, nextValue: boolean) => {
    const nextPrefs = { ...sectionPrefs, [key]: nextValue };
    setSectionPrefs(nextPrefs);
    writeSectionPrefs(nextPrefs);
  };

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="p-4 space-y-4 pb-6"
    >
      {offlineSnapshotLabel && (
        <motion.div variants={fadeUp}>
          <Card className="border-warning/25 bg-warning/5">
            <CardContent className="p-3 flex items-center justify-between gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 text-warning">
                <Download className="w-3.5 h-3.5" />
                {offlineSnapshotLabel}
              </span>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <motion.div variants={fadeUp}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Link
            href="/expenses"
            className="inline-flex items-center justify-center rounded-md border border-border bg-transparent hover:bg-accent h-8 px-3 text-xs font-medium"
          >
            Add Expense
          </Link>
          <Link
            href="/expenses?type=income"
            className="inline-flex items-center justify-center rounded-md border border-border bg-transparent hover:bg-accent h-8 px-3 text-xs font-medium"
          >
            Add Income
          </Link>
          <Link
            href="/investments"
            className="inline-flex items-center justify-center rounded-md border border-border bg-transparent hover:bg-accent h-8 px-3 text-xs font-medium"
          >
            Add Investment
          </Link>
          <Link
            href="/goals"
            className="inline-flex items-center justify-center rounded-md border border-border bg-transparent hover:bg-accent h-8 px-3 text-xs font-medium"
          >
            Goal Update
          </Link>
        </div>
      </motion.div>

      <motion.div variants={fadeUp}>
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => setShowCustomize((prev) => !prev)}>
            <SlidersHorizontal className="w-4 h-4 mr-1" />
            Customize
            {hiddenCount > 0 ? ` (${hiddenCount} hidden)` : ""}
            {showCustomize ? <ChevronUp className="w-3.5 h-3.5 ml-1" /> : <ChevronDown className="w-3.5 h-3.5 ml-1" />}
          </Button>
        </div>
        {showCustomize && (
          <Card className="mt-2">
            <CardContent className="p-3 grid grid-cols-2 gap-2 text-xs">
              {[
                { key: "dueSoon" as const, label: "Due soon" },
                { key: "watchlist" as const, label: "Watchlist" },
                { key: "timeline" as const, label: "Net worth timeline" },
                { key: "goals" as const, label: "Goals" },
                { key: "transactions" as const, label: "Recent transactions" },
                { key: "ai" as const, label: "AI insights" },
                { key: "risk" as const, label: "Risk signals" },
              ].map((item) => (
                <label key={item.key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sectionPrefs[item.key]}
                    onChange={(event) => updateSectionPref(item.key, event.target.checked)}
                    className="w-3.5 h-3.5 accent-primary"
                  />
                  {item.label}
                </label>
              ))}
            </CardContent>
          </Card>
        )}
      </motion.div>

      {/* Net Worth Card */}
      <motion.div variants={fadeUp}>
        <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground border-0">
          <CardContent className="p-5">
            <p className="text-xs opacity-70 font-medium">Net Worth</p>
            <p className="text-2xl sm:text-3xl font-bold mt-1">
              {formatCurrency(nw?.netWorth || 0)}
            </p>
            <div className="flex gap-4 mt-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="text-xs opacity-60">Assets</p>
                  <p className="text-xs font-semibold">
                    {formatCurrency(nw?.totalAssets || 0, "INR", true)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                  <ArrowDownRight className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="text-xs opacity-60">Liabilities</p>
                  <p className="text-xs font-semibold">
                    {formatCurrency(nw?.totalLiabilities || 0, "INR", true)}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Accounts Quick View */}
      {accounts.length > 0 && (
        <motion.div variants={fadeUp}>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Accounts</CardTitle>
                <Link
                  href="/accounts"
                  className="text-xs text-muted-foreground flex items-center"
                >
                  See all <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {accounts.slice(0, 4).map((acc) => {
                  const Icon = ACCOUNT_ICONS[acc.type] || Wallet;
                  const balance = toDecimal(acc.balance);
                  const color = acc.color || "#3b82f6";
                  return (
                    <Link
                      key={acc.id}
                      href="/accounts"
                      className="flex items-center justify-between gap-2 group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: `${color}15`, color }}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-medium group-hover:text-primary transition-colors truncate">
                          {acc.name}
                        </span>
                      </div>
                      <span
                        className={`text-sm font-semibold shrink-0 ${
                          balance < 0 ? "text-destructive" : ""
                        }`}
                      >
                        {formatCurrency(balance)}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Quick Stats */}
      <motion.div variants={fadeUp} className="grid grid-cols-2 gap-2 sm:gap-3">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">This Month Expense</p>
            <p className="text-base font-bold text-destructive">{formatCurrency(monthExpense, "INR", true)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Savings Rate</p>
            <p className={`text-base font-bold ${savingsRate >= 0 ? "text-success" : "text-destructive"}`}>
              {savingsRate.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {sectionPrefs.dueSoon && dueNudges.length > 0 && (
        <motion.div variants={fadeUp}>
          <Card className="border-warning/25">
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5">
                <BellRing className="w-4 h-4 text-warning" />
                Due Soon
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {dueNudges.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/60 px-3 py-2 hover:border-primary/30 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{item.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.subLabel}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-semibold">{item.dueText}</p>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}

      <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
        <Link href="/investments">
          <Card className="hover:border-primary/30 transition-colors">
            <CardContent className="p-3 text-center">
              <TrendingUp className="w-5 h-5 mx-auto text-success mb-1" />
              <p className="text-xs text-muted-foreground">Investments</p>
              <p className="text-xs sm:text-sm font-bold">
                {formatCurrency(nw?.breakdown.investments || 0, "INR", true)}
              </p>
              {investGainPercent !== 0 && (
                <p
                  className={`text-xs font-medium ${investGain >= 0 ? "text-success" : "text-destructive"}`}
                >
                  {investGain >= 0 ? "+" : ""}
                  {investGainPercent.toFixed(1)}%
                </p>
              )}
            </CardContent>
          </Card>
        </Link>
        <Link href="/offline-assets">
          <Card className="hover:border-primary/30 transition-colors">
            <CardContent className="p-3 text-center">
              <Wallet className="w-5 h-5 mx-auto text-warning mb-1" />
              <p className="text-xs text-muted-foreground">Assets</p>
              <p className="text-xs sm:text-sm font-bold">
                {formatCurrency(nw?.breakdown.offlineAssets || 0, "INR", true)}
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/goals">
          <Card className="hover:border-primary/30 transition-colors">
            <CardContent className="p-3 text-center">
              <Target className="w-5 h-5 mx-auto text-primary mb-1" />
              <p className="text-xs text-muted-foreground">Goals</p>
              <p className="text-xs sm:text-sm font-bold">{goals.length}</p>
              <p className="text-xs text-muted-foreground">active</p>
            </CardContent>
          </Card>
        </Link>
      </motion.div>

      {sectionPrefs.watchlist && (
      <motion.div variants={fadeUp}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4" />
                Watchlist
              </CardTitle>
              <div className="flex items-center gap-2">
                <Input
                  value={watchInput}
                  onChange={(e) => setWatchInput(e.target.value)}
                  placeholder="RELIANCE.NS"
                  className="h-8 text-xs"
                />
                <Button size="sm" variant="outline" onClick={addWatchlistSymbol}>
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {watchQuotes.length === 0 ? (
              <EmptyState
                icon={<BarChart3 className="w-8 h-8" />}
                title="No watchlist symbols"
                description="Add symbols to track market prices on the dashboard."
                className="py-6"
              />
            ) : (
              watchQuotes.map((row) => (
                <div key={row.symbol} className="flex items-center justify-between text-xs">
                  <span>{row.symbol}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{formatCurrency(row.price, "INR", true)}</span>
                    <button
                      className="text-destructive/70 hover:text-destructive"
                      onClick={() => removeWatchlistSymbol(row.symbol)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </motion.div>
      )}

      {sectionPrefs.timeline && (
      <motion.div variants={fadeUp}>
        <Card>
          <CardHeader>
            <CardTitle>Net Worth Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <LineChart data={netWorthTrend} dataKey="NetWorth" xAxisKey="month" color="#3b82f6" height={180} />
          </CardContent>
        </Card>
      </motion.div>
      )}

      {/* Goals Progress */}
      {sectionPrefs.goals && goals.length > 0 && (
        <motion.div variants={fadeUp}>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Goals</CardTitle>
                <Link
                  href="/goals"
                  className="text-xs text-muted-foreground flex items-center"
                >
                  See all <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {goals.slice(0, 4).map((goal) => {
                  const current = toDecimal(goal.currentAmount);
                  const target = toDecimal(goal.targetAmount);
                  const percent = target > 0 ? Math.round((current / target) * 100) : 0;
                  return (
                    <div key={goal.id} className="flex flex-col items-center min-w-0">
                      <ProgressRing
                        value={current}
                        max={target}
                        size={56}
                        strokeWidth={5}
                        color={goal.color || "#22c55e"}
                        label={`${percent}%`}
                      />
                      <p className="text-xs font-medium mt-1.5 text-center truncate w-full">
                        {goal.name}
                      </p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Recent Transactions */}
      {sectionPrefs.transactions && (
      <motion.div variants={fadeUp}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Transactions</CardTitle>
              <Link
                href="/expenses"
                className="text-xs text-muted-foreground flex items-center"
              >
                See all <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <EmptyState
                icon={<PiggyBank className="w-8 h-8" />}
                title="No transactions yet"
                description="Tap + to add your first expense."
                className="py-6"
              />
            ) : (
              <div className="space-y-3">
                {transactions.map((txn) => (
                  <div
                    key={txn.id}
                    className="flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0"
                        style={{
                          backgroundColor: txn.category?.color
                            ? `${txn.category.color}15`
                            : "var(--muted)",
                          color: txn.category?.color || "var(--muted-foreground)",
                        }}
                      >
                        {txn.type === "income" ? (
                          <TrendingUp className="w-4 h-4" />
                        ) : (
                          <TrendingDown className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {txn.description || txn.category?.name || "Transaction"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(txn.date)}
                        </p>
                      </div>
                    </div>
                    <p
                      className={`text-sm font-semibold shrink-0 ${
                        txn.type === "income"
                          ? "text-success"
                          : "text-foreground"
                      }`}
                    >
                      {txn.type === "income" ? "+" : "-"}
                      {formatCurrency(toDecimal(txn.amount))}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
      )}

      {/* AI Insights */}
      {sectionPrefs.ai && aiInsights && (
        <motion.div variants={fadeUp}>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>AI Insights</CardTitle>
                <Link href="/recommendations" className="text-xs text-muted-foreground">
                  Open recommendations
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{aiInsights.summary}</p>
              {aiInsights.suggestions?.length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-1.5">Suggestions</p>
                  <ul className="space-y-1">
                    {aiInsights.suggestions.slice(0, 3).map((s, i) => (
                      <li key={i} className="text-xs text-muted-foreground">
                        • {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {aiInsights.alerts?.length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-1.5 text-destructive">Alerts</p>
                  <ul className="space-y-1">
                    {aiInsights.alerts.slice(0, 2).map((a, i) => (
                      <li key={i} className="text-xs text-destructive/80">
                        • {a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {sectionPrefs.risk && layerInsights && (
        <motion.div variants={fadeUp}>
          <Card>
            <CardHeader>
              <CardTitle>Risk & Spending Signals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {layerInsights.concentration?.length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-1.5">Concentration risk</p>
                  <div className="space-y-1.5">
                    {layerInsights.concentration.slice(0, 3).map((row) => (
                      <div key={row.symbol} className="flex items-center justify-between text-xs">
                        <span className="truncate">
                          {row.symbol} ({row.riskLevel})
                        </span>
                        <span>{row.weight.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {layerInsights.anomalies?.length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-1.5">Spending anomalies</p>
                  <div className="space-y-1.5">
                    {layerInsights.anomalies.slice(0, 3).map((row) => (
                      <div key={row.category} className="flex items-center justify-between text-xs">
                        <span className="truncate">{row.category}</span>
                        <span className="text-warning">+{row.jumpPercent.toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}
