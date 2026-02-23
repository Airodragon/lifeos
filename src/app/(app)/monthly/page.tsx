"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  PiggyBank,
  ChevronLeft,
  ChevronRight,
  BarChart3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DonutChart } from "@/components/charts/donut-chart";
import { BarChart } from "@/components/charts/bar-chart";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, getMonthName } from "@/lib/utils";

interface MonthlyData {
  month: number;
  year: number;
  income: number;
  expense: number;
  savings: number;
  savingsRate: number;
  prevIncome: number;
  prevExpense: number;
  incomeChange: number;
  expenseChange: number;
  topCategories: { name: string; amount: number; color: string }[];
  dailyData: { day: number; amount: number }[];
  transactionCount: number;
  avgDailySpend: number;
  projectedMonthly: number;
}

export default function MonthlyOverviewPage() {
  const [data, setData] = useState<MonthlyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    setLoading(true);
    fetch(`/api/monthly-overview?month=${month}&year=${year}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [month, year]);

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(year - 1); }
    else setMonth(month - 1);
  };

  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(year + 1); }
    else setMonth(month + 1);
  };

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!data) return null;

  const donutData = data.topCategories.map((c) => ({
    name: c.name,
    value: c.amount,
    color: c.color,
  }));

  const dailyBarData = data.dailyData.map((d) => ({
    day: String(d.day),
    Spent: d.amount,
  }));

  return (
    <div className="p-4 space-y-4 pb-6">
      {/* Month Selector */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-muted">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-semibold">
          {getMonthName(data.month)} {data.year}
        </h2>
        <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-muted">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Summary Hero */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground border-0">
          <CardContent className="p-5">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-[10px] opacity-60">Income</p>
                <p className="text-sm font-bold">{formatCurrency(data.income, "INR", true)}</p>
                {data.incomeChange !== 0 && (
                  <div className={`flex items-center justify-center gap-0.5 text-[10px] ${data.incomeChange >= 0 ? "opacity-80" : "text-red-300"}`}>
                    {data.incomeChange >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {Math.abs(data.incomeChange).toFixed(0)}%
                  </div>
                )}
              </div>
              <div>
                <p className="text-[10px] opacity-60">Expenses</p>
                <p className="text-sm font-bold">{formatCurrency(data.expense, "INR", true)}</p>
                {data.expenseChange !== 0 && (
                  <div className={`flex items-center justify-center gap-0.5 text-[10px] ${data.expenseChange <= 0 ? "opacity-80" : "text-red-300"}`}>
                    {data.expenseChange >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {Math.abs(data.expenseChange).toFixed(0)}%
                  </div>
                )}
              </div>
              <div>
                <p className="text-[10px] opacity-60">Saved</p>
                <p className="text-sm font-bold">{formatCurrency(data.savings, "INR", true)}</p>
                <p className="text-[10px] opacity-60">{data.savingsRate.toFixed(0)}% rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-2">
        <Card>
          <CardContent className="p-3 text-center">
            <BarChart3 className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-[10px] text-muted-foreground">Transactions</p>
            <p className="text-sm font-bold">{data.transactionCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <TrendingDown className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-[10px] text-muted-foreground">Avg/Day</p>
            <p className="text-sm font-bold">{formatCurrency(data.avgDailySpend, "INR", true)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <PiggyBank className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-[10px] text-muted-foreground">Projected</p>
            <p className="text-sm font-bold">{formatCurrency(data.projectedMonthly, "INR", true)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Savings Rate */}
      {data.income > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Savings Rate</p>
              <span className={`text-sm font-bold ${data.savingsRate >= 20 ? "text-success" : data.savingsRate >= 0 ? "text-warning" : "text-destructive"}`}>
                {data.savingsRate.toFixed(1)}%
              </span>
            </div>
            <Progress value={Math.max(0, data.savings)} max={data.income} />
            <p className="text-[10px] text-muted-foreground mt-1.5">
              {data.savingsRate >= 20 ? "Great saving rate!" : data.savingsRate >= 0 ? "Try to save more this month" : "Spending exceeds income"}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Daily Spending */}
      {dailyBarData.some((d) => d.Spent > 0) && (
        <Card>
          <CardHeader><CardTitle>Daily Spending</CardTitle></CardHeader>
          <CardContent>
            <BarChart
              data={dailyBarData}
              bars={[{ dataKey: "Spent", color: "#ef4444", name: "Spent" }]}
              xAxisKey="day"
              height={180}
            />
          </CardContent>
        </Card>
      )}

      {/* Category Breakdown */}
      {donutData.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Spending by Category</CardTitle></CardHeader>
          <CardContent>
            <DonutChart
              data={donutData}
              innerLabel="Total"
              innerValue={formatCurrency(data.expense, "INR", true)}
              height={200}
            />
            <div className="mt-3 space-y-2">
              {data.topCategories.slice(0, 8).map((cat) => {
                const percent = data.expense > 0 ? (cat.amount / data.expense) * 100 : 0;
                return (
                  <div key={cat.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="truncate">{cat.name}</span>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <span className="font-medium">{formatCurrency(cat.amount, "INR", true)}</span>
                      <span className="text-[10px] text-muted-foreground ml-1">({percent.toFixed(0)}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
