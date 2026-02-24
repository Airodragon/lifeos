"use client";

import { useEffect, useState } from "react";
import { Sparkles, ShieldAlert, TrendingUp, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/utils";

interface RecommendationResponse {
  summary: string;
  portfolioActions: string[];
  spendingActions: string[];
  riskAlerts: string[];
  next7Days: string[];
  context: {
    monthIncome: number;
    monthExpense: number;
    savingsRate: number;
    watchlistCount: number;
    activePriceAlerts: number;
  };
}

interface RecommendationHistoryItem {
  id: string;
  summary: string;
  createdAt: string;
}

export default function RecommendationsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<RecommendationResponse | null>(null);
  const [history, setHistory] = useState<RecommendationHistoryItem[]>([]);

  const fetchRecommendations = async () => {
    setLoading(true);
    const res = await fetch("/api/ai/recommendations");
    const json = await res.json();
    setData(json?.error ? null : json);
    const historyRes = await fetch("/api/ai/recommendations/history");
    const historyJson = await historyRes.json();
    setHistory(Array.isArray(historyJson) ? historyJson : []);
    setLoading(false);
  };

  useEffect(() => {
    fetchRecommendations();
  }, []);

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4">
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Could not load recommendations right now.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 pb-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-1.5">
          <Sparkles className="w-5 h-5" />
          AI Recommendations
        </h2>
        <Button variant="outline" size="sm" onClick={fetchRecommendations}>
          Refresh
        </Button>
      </div>

      <Card>
        <CardContent className="p-3 text-sm text-muted-foreground">{data.summary}</CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <Card>
          <CardContent className="p-2.5">
            <p className="text-muted-foreground">Savings Rate</p>
            <p className="font-semibold">{data.context.savingsRate.toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-2.5">
            <p className="text-muted-foreground">Watchlist</p>
            <p className="font-semibold">{data.context.watchlistCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-2.5">
            <p className="text-muted-foreground">Active Alerts</p>
            <p className="font-semibold">{data.context.activePriceAlerts}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4" />
            Portfolio Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-xs text-muted-foreground">
          {data.portfolioActions.map((row, idx) => (
            <p key={idx}>- {row}</p>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Wallet className="w-4 h-4" />
            Spending Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-xs text-muted-foreground">
          {data.spendingActions.map((row, idx) => (
            <p key={idx}>- {row}</p>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4" />
            Risk Alerts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-xs text-muted-foreground">
          {(data.riskAlerts.length ? data.riskAlerts : ["No major risk alerts right now."]).map((row, idx) => (
            <p key={idx}>- {row}</p>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Next 7 Days</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-xs text-muted-foreground">
          {data.next7Days.map((row, idx) => (
            <p key={idx}>- {row}</p>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">History Snapshots</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-muted-foreground">
          {history.length === 0 ? (
            <p>No snapshots yet.</p>
          ) : (
            history.slice(0, 10).map((row) => (
              <div key={row.id} className="rounded-lg border border-border/40 p-2">
                <p className="text-foreground">{row.summary}</p>
                <p className="mt-1 text-[11px]">
                  {formatDateTime(row.createdAt)}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
