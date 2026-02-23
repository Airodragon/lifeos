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
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressRing } from "@/components/charts/progress-ring";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, toDecimal } from "@/lib/utils";
import { useFormat } from "@/hooks/use-format";

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

export default function DashboardPage() {
  const { fc: formatCurrency } = useFormat();
  const [netWorthData, setNetWorthData] = useState<DashboardData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/net-worth").then((r) => r.json()),
      fetch("/api/transactions?limit=5").then((r) => r.json()),
      fetch("/api/goals").then((r) => r.json()),
      fetch("/api/accounts").then((r) => r.json()),
    ]).then(([nw, txn, g, acc]) => {
      setNetWorthData(nw);
      setTransactions(txn.transactions || []);
      setGoals(g || []);
      setAccounts(acc || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const nw = netWorthData;
  const investGain = nw?.breakdown.investmentGain || 0;
  const investGainPercent = nw?.breakdown.investmentCost
    ? (investGain / nw.breakdown.investmentCost) * 100
    : 0;

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="p-4 space-y-4 pb-6"
    >
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
                  <p className="text-[10px] opacity-60">Assets</p>
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
                  <p className="text-[10px] opacity-60">Liabilities</p>
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
      <motion.div variants={fadeUp} className="grid grid-cols-3 gap-2 sm:gap-3">
        <Link href="/investments">
          <Card className="hover:border-primary/30 transition-colors">
            <CardContent className="p-3 text-center">
              <TrendingUp className="w-5 h-5 mx-auto text-success mb-1" />
              <p className="text-[10px] text-muted-foreground">Investments</p>
              <p className="text-xs sm:text-sm font-bold">
                {formatCurrency(nw?.breakdown.investments || 0, "INR", true)}
              </p>
              {investGainPercent !== 0 && (
                <p
                  className={`text-[10px] font-medium ${investGain >= 0 ? "text-success" : "text-destructive"}`}
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
              <p className="text-[10px] text-muted-foreground">Assets</p>
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
              <p className="text-[10px] text-muted-foreground">Goals</p>
              <p className="text-xs sm:text-sm font-bold">{goals.length}</p>
              <p className="text-[10px] text-muted-foreground">active</p>
            </CardContent>
          </Card>
        </Link>
      </motion.div>

      {/* Goals Progress */}
      {goals.length > 0 && (
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
              <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-none">
                {goals.slice(0, 4).map((goal) => {
                  const current = toDecimal(goal.currentAmount);
                  const target = toDecimal(goal.targetAmount);
                  const percent = target > 0 ? Math.round((current / target) * 100) : 0;
                  return (
                    <div key={goal.id} className="flex flex-col items-center min-w-[72px]">
                      <ProgressRing
                        value={current}
                        max={target}
                        size={56}
                        strokeWidth={5}
                        color={goal.color || "#22c55e"}
                        label={`${percent}%`}
                      />
                      <p className="text-[10px] font-medium mt-1.5 text-center truncate w-full">
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
              <div className="text-center py-6 text-sm text-muted-foreground">
                <PiggyBank className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No transactions yet</p>
                <p className="text-xs">Tap + to add your first expense</p>
              </div>
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
                        <p className="text-[10px] text-muted-foreground">
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
    </motion.div>
  );
}
