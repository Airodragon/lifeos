"use client";

import { useEffect, useState } from "react";
import { Scale, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useFormat } from "@/hooks/use-format";
import { BarChart } from "@/components/charts/bar-chart";
import { DonutChart } from "@/components/charts/donut-chart";

interface DriftRow {
  assetType: string;
  currentValue: number;
  currentWeight: number;
  targetWeight: number;
  driftPercent: number;
  suggestedAction: "buy" | "reduce" | "hold";
  adjustmentValue: number;
}

interface SymbolSuggestion {
  symbol: string;
  name: string;
  type: string;
  currentValue: number;
  action: "buy" | "reduce" | "hold";
  adjustmentValue: number;
  suggestedUnits: number;
}

interface RebalancePayload {
  targets: Record<string, number>;
  totalValue: number;
  drift: DriftRow[];
  symbolSuggestions: SymbolSuggestion[];
  exposureChart: Array<{
    type: string;
    currentValue: number;
    targetValue: number;
    currentWeight: number;
    targetWeight: number;
    drift: number;
  }>;
  allocationDonut: Array<{
    name: string;
    value: number;
    color: string;
  }>;
}

export default function RebalancePage() {
  const { fc: formatCurrency } = useFormat();
  const [data, setData] = useState<RebalancePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [targets, setTargets] = useState({
    stock: "45",
    etf: "30",
    mutual_fund: "20",
    crypto: "5",
  });

  const fetchData = async () => {
    setLoading(true);
    const res = await fetch("/api/investments/rebalance");
    const json = await res.json();
    setData(json);
    setTargets(
      Object.fromEntries(
        Object.entries(json.targets || {}).map(([k, v]) => [k, String(Math.round(Number(v)))])
      ) as typeof targets
    );
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const applyTargets = async () => {
    setApplying(true);
    const payload = {
      targets: {
        stock: Number(targets.stock || 0),
        etf: Number(targets.etf || 0),
        mutual_fund: Number(targets.mutual_fund || 0),
        crypto: Number(targets.crypto || 0),
      },
    };
    const res = await fetch("/api/investments/rebalance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    setData(json);
    setApplying(false);
  };

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
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Scale className="w-5 h-5" />
          Rebalance Assistant
        </h2>
        <Button size="sm" variant="outline" onClick={fetchData}>
          <RefreshCw className="w-4 h-4 mr-1" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Target Allocation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Stocks %"
              type="number"
              value={targets.stock}
              onChange={(e) => setTargets((p) => ({ ...p, stock: e.target.value }))}
            />
            <Input
              label="ETF %"
              type="number"
              value={targets.etf}
              onChange={(e) => setTargets((p) => ({ ...p, etf: e.target.value }))}
            />
            <Input
              label="Mutual Funds %"
              type="number"
              value={targets.mutual_fund}
              onChange={(e) => setTargets((p) => ({ ...p, mutual_fund: e.target.value }))}
            />
            <Input
              label="Crypto %"
              type="number"
              value={targets.crypto}
              onChange={(e) => setTargets((p) => ({ ...p, crypto: e.target.value }))}
            />
          </div>
          <Button className="w-full" onClick={applyTargets} disabled={applying}>
            {applying ? "Applying..." : "Recompute Suggestions"}
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Suggestions are advisory only. Review tax impact before making real trades.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">Portfolio Value</p>
          <p className="text-base font-semibold">{formatCurrency(data?.totalValue || 0, "INR", true)}</p>
        </CardContent>
      </Card>

      {(data?.allocationDonut || []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Current Allocation</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart
              data={data?.allocationDonut || []}
              innerLabel="Portfolio"
              innerValue={formatCurrency(data?.totalValue || 0, "INR", true)}
              height={210}
            />
          </CardContent>
        </Card>
      )}

      {(data?.exposureChart || []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Current vs Target Weight</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              data={(data?.exposureChart || []).map((row) => ({
                type: row.type.replace("_", " "),
                Current: row.currentValue,
                Target: row.targetValue,
              }))}
              xAxisKey="type"
              bars={[
                { dataKey: "Current", color: "#3b82f6", name: "Current Value" },
                { dataKey: "Target", color: "#22c55e", name: "Target Value" },
              ]}
              height={220}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Allocation Drift</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(data?.drift || []).map((d) => (
            <div key={d.assetType} className="rounded-xl border border-border/50 p-2 text-xs">
              <div className="flex items-center justify-between">
                <p className="font-medium capitalize">{d.assetType.replace("_", " ")}</p>
                <span className={d.suggestedAction === "buy" ? "text-success" : d.suggestedAction === "reduce" ? "text-warning" : "text-muted-foreground"}>
                  {d.suggestedAction.toUpperCase()}
                </span>
              </div>
              <p className="text-muted-foreground mt-1">
                {d.currentWeight.toFixed(1)}% now vs {d.targetWeight.toFixed(1)}% target
              </p>
              <p className="mt-1">
                Suggested value change: {formatCurrency(d.adjustmentValue, "INR", true)}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Symbol-level Suggestions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(data?.symbolSuggestions || []).slice(0, 12).map((s) => (
            <div key={s.symbol} className="rounded-xl border border-border/50 p-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{s.symbol}</p>
                <span className={s.action === "buy" ? "text-success" : s.action === "reduce" ? "text-warning" : "text-muted-foreground"}>
                  {s.action.toUpperCase()}
                </span>
              </div>
              <p className="text-muted-foreground truncate">{s.name}</p>
              <p className="mt-1">
                {formatCurrency(s.adjustmentValue, "INR", true)} ({s.suggestedUnits.toFixed(2)} units)
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
