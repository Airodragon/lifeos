"use client";

import { useEffect, useMemo, useState } from "react";
import { ReceiptText, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useFormat } from "@/hooks/use-format";
import { BarChart } from "@/components/charts/bar-chart";
import { DonutChart } from "@/components/charts/donut-chart";

interface TaxTxn {
  investmentId: string;
  symbol: string;
  date: string;
  quantity: number;
  saleAmount: number;
  cost: number;
  gain: number;
  holdingDays: number;
  taxBucket: "STCG" | "LTCG";
}

interface TaxResponse {
  fy: string;
  totals: {
    realizedGain: number;
    stcgGain: number;
    ltcgGain: number;
    stcgTaxEstimate: number;
    ltcgTaxEstimate: number;
    totalEstimatedTax: number;
  };
  harvestCandidates: TaxTxn[];
  transactions: TaxTxn[];
  monthlyRealized: Array<{
    month: string;
    STCG: number;
    LTCG: number;
    Net: number;
  }>;
  taxBreakup: Array<{
    name: string;
    value: number;
    color: string;
  }>;
}

export default function TaxCenterPage() {
  const { fc: formatCurrency } = useFormat();
  const [fyStartYear, setFyStartYear] = useState(String(new Date().getFullYear()));
  const [data, setData] = useState<TaxResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async (year = fyStartYear) => {
    setLoading(true);
    const res = await fetch(`/api/investments/tax-center?fyStartYear=${encodeURIComponent(year)}`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const topTaxLots = useMemo(() => (data?.transactions || []).slice(0, 12), [data]);

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
          <ReceiptText className="w-5 h-5" />
          Tax Center
        </h2>
        <Button variant="outline" size="sm" onClick={() => fetchData()}>
          <RefreshCw className="w-4 h-4 mr-1" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardContent className="p-3 flex items-end gap-2">
          <Input
            label="FY Start Year"
            type="number"
            value={fyStartYear}
            onChange={(e) => setFyStartYear(e.target.value)}
          />
          <Button onClick={() => fetchData(fyStartYear)} className="mb-0.5">
            Load FY
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">STCG Estimate</p>
            <p className="text-sm font-semibold">{formatCurrency(data?.totals.stcgTaxEstimate || 0, "INR", true)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">LTCG Estimate</p>
            <p className="text-sm font-semibold">{formatCurrency(data?.totals.ltcgTaxEstimate || 0, "INR", true)}</p>
          </CardContent>
        </Card>
      </div>

      {(data?.taxBreakup || []).some((x) => x.value > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Estimated Tax Breakup</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart
              data={data?.taxBreakup || []}
              innerLabel={data?.fy || "FY"}
              innerValue={formatCurrency(data?.totals.totalEstimatedTax || 0, "INR", true)}
              height={210}
            />
          </CardContent>
        </Card>
      )}

      {(data?.monthlyRealized || []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Monthly Realized Gains</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              data={(data?.monthlyRealized || []).map((row) => ({
                month: `${row.month.split("-")[1]}/${row.month.slice(2, 4)}`,
                STCG: row.STCG,
                LTCG: row.LTCG,
              }))}
              bars={[
                { dataKey: "STCG", color: "#f97316", name: "STCG" },
                { dataKey: "LTCG", color: "#22c55e", name: "LTCG" },
              ]}
              xAxisKey="month"
              height={220}
              stacked
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground">Total Estimated Tax ({data?.fy})</p>
          <p className="text-base font-semibold">{formatCurrency(data?.totals.totalEstimatedTax || 0, "INR", true)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Realized gain: {formatCurrency(data?.totals.realizedGain || 0, "INR", true)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Tax-Harvest Opportunities</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(data?.harvestCandidates || []).length === 0 ? (
            <p className="text-xs text-muted-foreground">No loss positions realized this FY.</p>
          ) : (
            data?.harvestCandidates.map((row) => (
              <div key={`${row.investmentId}-${row.date}`} className="rounded-xl border border-border/50 p-2 text-xs">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{row.symbol}</p>
                  <span className="text-destructive">{formatCurrency(row.gain, "INR", true)}</span>
                </div>
                <p className="text-muted-foreground">{new Date(row.date).toLocaleDateString("en-IN")}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Realized Sell Lots</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {topTaxLots.map((row) => (
            <div key={`${row.investmentId}-${row.date}-${row.quantity}`} className="rounded-xl border border-border/50 p-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{row.symbol}</p>
                <span className={row.taxBucket === "STCG" ? "text-warning" : "text-success"}>
                  {row.taxBucket}
                </span>
              </div>
              <p className="text-muted-foreground">
                {row.quantity} units · {row.holdingDays} days
              </p>
              <p>
                Gain:{" "}
                <span className={row.gain >= 0 ? "text-success" : "text-destructive"}>
                  {formatCurrency(row.gain, "INR", true)}
                </span>
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
