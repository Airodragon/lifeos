"use client";

import { useEffect, useMemo, useState } from "react";
import { Target, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useFormat } from "@/hooks/use-format";
import { BarChart } from "@/components/charts/bar-chart";
import { LineChart } from "@/components/charts/line-chart";

interface GoalPlan {
  goalId: string;
  name: string;
  target: number;
  current: number;
  remaining: number;
  monthsLeft: number;
  monthlyRequired: number;
  projectedAtDeadline: number;
  shortfall: number;
  status: "on_track" | "at_risk" | "off_track";
}

interface GoalPlanResponse {
  portfolioValue: number;
  avgMonthlySavings: number;
  investableMonthly: number;
  goalPlans: GoalPlan[];
  monthlyTrend: Array<{
    month: string;
    income: number;
    expense: number;
    savings: number;
  }>;
  goalMix: Array<{
    name: string;
    target: number;
    current: number;
    projected: number;
    shortfall: number;
  }>;
}

export default function GoalInvestingPage() {
  const { fc: formatCurrency } = useFormat();
  const [data, setData] = useState<GoalPlanResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    const res = await fetch("/api/investments/goal-plan");
    const json = await res.json();
    setData(json);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const totalShortfall = useMemo(
    () => (data?.goalPlans || []).reduce((sum, goal) => sum + goal.shortfall, 0),
    [data]
  );
  const monthlyTrendData = useMemo(() => {
    return (data?.monthlyTrend || []).map((row) => {
      const parts = row.month.split("-");
      const monthLabel = `${parts[1]}/${parts[0].slice(2)}`;
      return {
        month: monthLabel,
        Savings: row.savings,
        Income: row.income,
        Expenses: row.expense,
      };
    });
  }, [data]);
  const goalMixData = useMemo(
    () =>
      (data?.goalMix || []).map((goal) => ({
        month: goal.name.length > 8 ? `${goal.name.slice(0, 8)}...` : goal.name,
        Target: goal.target,
        Current: goal.current,
        Projected: goal.projected,
      })),
    [data]
  );

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 pb-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Goal-Based Investing</h2>
          <p className="text-xs text-muted-foreground">SIP guidance by goal shortfall and timeline</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData}>
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">Investable / month</p>
            <p className="text-sm font-semibold">{formatCurrency(data?.investableMonthly || 0, "INR", true)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">Total shortfall</p>
            <p className="text-sm font-semibold">{formatCurrency(totalShortfall, "INR", true)}</p>
          </CardContent>
        </Card>
      </div>

      {monthlyTrendData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Monthly Savings Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <LineChart data={monthlyTrendData} dataKey="Savings" xAxisKey="month" color="#22c55e" height={180} />
          </CardContent>
        </Card>
      )}

      {goalMixData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Goal Progress vs Projection</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              data={goalMixData}
              xAxisKey="month"
              bars={[
                { dataKey: "Current", color: "#3b82f6", name: "Current" },
                { dataKey: "Projected", color: "#22c55e", name: "Projected" },
                { dataKey: "Target", color: "#8b5cf6", name: "Target" },
              ]}
              height={220}
            />
          </CardContent>
        </Card>
      )}

      {!data?.goalPlans?.length ? (
        <Card>
          <CardContent className="p-5 text-sm text-muted-foreground text-center">
            Add active goals to unlock goal-wise SIP recommendations.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {data.goalPlans.map((goal) => {
            const progress = goal.target > 0 ? (goal.current / goal.target) * 100 : 0;
            const statusBadge =
              goal.status === "on_track" ? "success" : goal.status === "at_risk" ? "warning" : "destructive";
            return (
              <Card key={goal.goalId}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm flex items-center gap-1.5">
                      <Target className="w-4 h-4" />
                      {goal.name}
                    </CardTitle>
                    <Badge variant={statusBadge}>{goal.status.replace("_", " ")}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>{formatCurrency(goal.current, "INR", true)}</span>
                      <span>{formatCurrency(goal.target, "INR", true)}</span>
                    </div>
                    <Progress value={Math.max(0, Math.min(100, progress))} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl border border-border/50 p-2">
                      <p className="text-muted-foreground">Required SIP</p>
                      <p className="font-semibold">{formatCurrency(goal.monthlyRequired, "INR", true)}/mo</p>
                    </div>
                    <div className="rounded-xl border border-border/50 p-2">
                      <p className="text-muted-foreground">Projected</p>
                      <p className="font-semibold">{formatCurrency(goal.projectedAtDeadline, "INR", true)}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {goal.monthsLeft.toFixed(1)} months left
                    </span>
                    <span className={goal.shortfall > 0 ? "text-warning" : "text-success"}>
                      {goal.shortfall > 0 ? (
                        <>
                          <AlertTriangle className="w-3 h-3 inline mr-1" />
                          Shortfall {formatCurrency(goal.shortfall, "INR", true)}
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3 h-3 inline mr-1" />
                          On track
                        </>
                      )}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardContent className="p-3 text-xs text-muted-foreground flex items-start gap-2">
          <TrendingUp className="w-4 h-4 mt-0.5 shrink-0" />
          Required SIP is based on current progress and deadline. Projection assumes a 12% annual return and current
          investable monthly surplus.
        </CardContent>
      </Card>
    </div>
  );
}
