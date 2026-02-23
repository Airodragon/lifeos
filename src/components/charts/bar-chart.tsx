"use client";

import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

interface BarChartProps {
  data: Record<string, unknown>[];
  bars: { dataKey: string; color: string; name?: string }[];
  xAxisKey?: string;
  height?: number;
  currency?: string;
  stacked?: boolean;
}

export function BarChart({
  data,
  bars,
  xAxisKey = "month",
  height = 200,
  currency = "INR",
  stacked = false,
}: BarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
        <XAxis
          dataKey={xAxisKey}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => formatCurrency(v, currency, true)}
        />
        <Tooltip
          content={({ payload, label }) => {
            if (!payload?.length) return null;
            return (
              <div className="rounded-lg bg-card border border-border/50 shadow-lg p-2 text-xs">
                <p className="text-muted-foreground mb-1">{label}</p>
                {payload.map((item, i) => (
                  <p key={i} className="font-medium" style={{ color: item.color }}>
                    {item.name}: {formatCurrency(item.value as number, currency)}
                  </p>
                ))}
              </div>
            );
          }}
        />
        {bars.map((bar) => (
          <Bar
            key={bar.dataKey}
            dataKey={bar.dataKey}
            fill={bar.color}
            name={bar.name || bar.dataKey}
            radius={[4, 4, 0, 0]}
            stackId={stacked ? "stack" : undefined}
          />
        ))}
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}
