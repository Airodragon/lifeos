"use client";

import { useEffect, useState } from "react";
import { BarChart3, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { DonutChart } from "@/components/charts/donut-chart";
import { BarChart } from "@/components/charts/bar-chart";
import { LineChart } from "@/components/charts/line-chart";
import { Skeleton } from "@/components/ui/skeleton";
import { toDecimal, getMonthName } from "@/lib/utils";
import { useFormat } from "@/hooks/use-format";
import { CATEGORY_COLORS } from "@/types";

interface Transaction {
  id: string;
  amount: string;
  type: string;
  date: string;
  category: { name: string; color: string | null } | null;
}

export default function AnalyticsPage() {
  const { fc: formatCurrency } = useFormat();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("6m");

  useEffect(() => {
    const months = period === "1m" ? 1 : period === "3m" ? 3 : period === "6m" ? 6 : 12;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    fetch(`/api/transactions?limit=500&startDate=${startDate.toISOString()}`)
      .then((r) => r.json())
      .then((d) => {
        setTransactions(d.transactions || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [period]);

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const expenses = transactions.filter((t) => t.type === "expense");
  const income = transactions.filter((t) => t.type === "income");
  const totalExpenses = expenses.reduce((s, t) => s + toDecimal(t.amount), 0);
  const totalIncome = income.reduce((s, t) => s + toDecimal(t.amount), 0);
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

  // Category breakdown
  const categoryMap = new Map<string, number>();
  expenses.forEach((t) => {
    const cat = t.category?.name || "Other";
    categoryMap.set(cat, (categoryMap.get(cat) || 0) + toDecimal(t.amount));
  });
  const categoryData = Array.from(categoryMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({
      name,
      value,
      color: CATEGORY_COLORS[name] || "#6b7280",
    }));

  // Monthly data
  const monthlyMap = new Map<string, { income: number; expense: number }>();
  transactions.forEach((t) => {
    const d = new Date(t.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!monthlyMap.has(key)) monthlyMap.set(key, { income: 0, expense: 0 });
    const entry = monthlyMap.get(key)!;
    if (t.type === "income") entry.income += toDecimal(t.amount);
    else if (t.type === "expense") entry.expense += toDecimal(t.amount);
  });

  const monthlyData = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => ({
      month: getMonthName(parseInt(key.split("-")[1])).slice(0, 3),
      Income: val.income,
      Expenses: val.expense,
      Savings: val.income - val.expense,
    }));

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-semibold">Analytics</h2>

      <Tabs
        tabs={[
          { id: "1m", label: "1M" },
          { id: "3m", label: "3M" },
          { id: "6m", label: "6M" },
          { id: "1y", label: "1Y" },
        ]}
        activeTab={period}
        onChange={setPeriod}
      />

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <TrendingUp className="w-4 h-4 mx-auto text-success mb-1" />
            <p className="text-[10px] text-muted-foreground">Income</p>
            <p className="text-sm font-bold text-success">{formatCurrency(totalIncome, "INR", true)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <TrendingDown className="w-4 h-4 mx-auto text-destructive mb-1" />
            <p className="text-[10px] text-muted-foreground">Expenses</p>
            <p className="text-sm font-bold text-destructive">{formatCurrency(totalExpenses, "INR", true)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <BarChart3 className="w-4 h-4 mx-auto text-primary mb-1" />
            <p className="text-[10px] text-muted-foreground">Savings</p>
            <p className="text-sm font-bold">{savingsRate.toFixed(0)}%</p>
          </CardContent>
        </Card>
      </div>

      {monthlyData.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Income vs Expenses</CardTitle></CardHeader>
          <CardContent>
            <BarChart
              data={monthlyData}
              bars={[
                { dataKey: "Income", color: "#22c55e", name: "Income" },
                { dataKey: "Expenses", color: "#ef4444", name: "Expenses" },
              ]}
              height={220}
            />
          </CardContent>
        </Card>
      )}

      {monthlyData.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Savings Trend</CardTitle></CardHeader>
          <CardContent>
            <LineChart
              data={monthlyData}
              dataKey="Savings"
              xAxisKey="month"
              color="#3b82f6"
              height={180}
            />
          </CardContent>
        </Card>
      )}

      {categoryData.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Spending by Category</CardTitle></CardHeader>
          <CardContent>
            <DonutChart
              data={categoryData}
              innerLabel="Total"
              innerValue={formatCurrency(totalExpenses, "INR", true)}
              height={220}
            />
            <div className="mt-3 space-y-2">
              {categoryData.slice(0, 8).map((item) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span>{item.name}</span>
                  </div>
                  <span className="font-medium">{formatCurrency(item.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
