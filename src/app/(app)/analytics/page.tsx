"use client";

import { useEffect, useState } from "react";
import { BarChart3, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

interface WeeklyBrief {
  summary: string;
  wins: string[];
  risks: string[];
  nextActions: string[];
  metrics: {
    weeklyIncome: number;
    weeklyExpense: number;
    weeklySavings: number;
    portfolioChangePercent: number;
  };
}

export default function AnalyticsPage() {
  const { fc: formatCurrency } = useFormat();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("6m");
  const [brief, setBrief] = useState<WeeklyBrief | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [simLoading, setSimLoading] = useState(false);
  const [simulation, setSimulation] = useState<{
    baseProjection: number;
    improvedProjection: number;
    delta: number;
    goalEtaMonths: number | null;
  } | null>(null);
  const [simForm, setSimForm] = useState({
    currentCorpus: "",
    monthlyContribution: "",
    monthlyContributionAlt: "",
    annualReturn: "12",
    years: "10",
    goalAmount: "",
  });

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

  const fetchWeeklyBrief = async () => {
    setBriefLoading(true);
    try {
      const res = await fetch("/api/ai/cfo-brief");
      const data = await res.json();
      if (res.ok) setBrief(data);
    } finally {
      setBriefLoading(false);
    }
  };

  const runSimulation = async () => {
    setSimLoading(true);
    try {
      const res = await fetch("/api/analytics/what-if", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentCorpus: Number(simForm.currentCorpus || 0),
          monthlyContribution: Number(simForm.monthlyContribution || 0),
          monthlyContributionAlt: Number(simForm.monthlyContributionAlt || 0),
          annualReturn: Number(simForm.annualReturn || 12),
          years: Number(simForm.years || 10),
          goalAmount: Number(simForm.goalAmount || 0),
        }),
      });
      const data = await res.json();
      if (res.ok) setSimulation(data);
    } finally {
      setSimLoading(false);
    }
  };

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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Weekly AI CFO Brief</CardTitle>
          <Button size="sm" variant="outline" onClick={fetchWeeklyBrief} disabled={briefLoading}>
            {briefLoading ? "Generating..." : "Generate"}
          </Button>
        </CardHeader>
        <CardContent>
          {!brief ? (
            <p className="text-sm text-muted-foreground">
              Generate your weekly finance brief with wins, risks, and next actions.
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm">{brief.summary}</p>
              <div className="text-xs text-muted-foreground">
                Weekly: +{formatCurrency(brief.metrics.weeklyIncome, "INR", true)} income, -
                {formatCurrency(brief.metrics.weeklyExpense, "INR", true)} expense, savings{" "}
                {formatCurrency(brief.metrics.weeklySavings, "INR", true)}
              </div>
              {brief.wins.length > 0 && (
                <div>
                  <p className="text-xs font-semibold mb-1">Wins</p>
                  <div className="space-y-1">
                    {brief.wins.map((w) => (
                      <p key={w} className="text-sm">- {w}</p>
                    ))}
                  </div>
                </div>
              )}
              {brief.risks.length > 0 && (
                <div>
                  <p className="text-xs font-semibold mb-1">Risks</p>
                  <div className="space-y-1">
                    {brief.risks.map((r) => (
                      <p key={r} className="text-sm">- {r}</p>
                    ))}
                  </div>
                </div>
              )}
              {brief.nextActions.length > 0 && (
                <div>
                  <p className="text-xs font-semibold mb-1">Next 7 Days</p>
                  <div className="space-y-1">
                    {brief.nextActions.map((a) => (
                      <p key={a} className="text-sm">- {a}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What-If Simulator</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Current Corpus"
              type="number"
              inputMode="decimal"
              value={simForm.currentCorpus}
              onChange={(e) => setSimForm((p) => ({ ...p, currentCorpus: e.target.value }))}
            />
            <Input
              label="Current Monthly Invest"
              type="number"
              inputMode="decimal"
              value={simForm.monthlyContribution}
              onChange={(e) =>
                setSimForm((p) => ({ ...p, monthlyContribution: e.target.value }))
              }
            />
            <Input
              label="Improved Monthly Invest"
              type="number"
              inputMode="decimal"
              value={simForm.monthlyContributionAlt}
              onChange={(e) =>
                setSimForm((p) => ({ ...p, monthlyContributionAlt: e.target.value }))
              }
            />
            <Input
              label="Expected Return %"
              type="number"
              inputMode="decimal"
              value={simForm.annualReturn}
              onChange={(e) => setSimForm((p) => ({ ...p, annualReturn: e.target.value }))}
            />
            <Input
              label="Years"
              type="number"
              inputMode="decimal"
              value={simForm.years}
              onChange={(e) => setSimForm((p) => ({ ...p, years: e.target.value }))}
            />
            <Input
              label="Goal Amount (optional)"
              type="number"
              inputMode="decimal"
              value={simForm.goalAmount}
              onChange={(e) => setSimForm((p) => ({ ...p, goalAmount: e.target.value }))}
            />
          </div>
          <Button className="w-full" onClick={runSimulation} disabled={simLoading}>
            {simLoading ? "Calculating..." : "Run What-If"}
          </Button>
          {simulation && (
            <div className="rounded-xl border border-border p-3 space-y-1 text-sm">
              <p>Base projection: {formatCurrency(simulation.baseProjection, "INR", true)}</p>
              <p>Improved projection: {formatCurrency(simulation.improvedProjection, "INR", true)}</p>
              <p className="font-medium">Delta: {formatCurrency(simulation.delta, "INR", true)}</p>
              {simulation.goalEtaMonths && (
                <p>Goal ETA: ~{Math.ceil(simulation.goalEtaMonths / 12)} years</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
