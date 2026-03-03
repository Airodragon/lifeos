"use client";

import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import { useChartColors } from "@/hooks/use-chart-colors";

interface LineChartProps {
  data: Record<string, unknown>[];
  dataKey: string;
  xAxisKey?: string;
  color?: string;
  height?: number;
  showGrid?: boolean;
  currency?: string;
}

export function LineChart({
  data,
  dataKey,
  xAxisKey = "date",
  color,
  height = 200,
  showGrid = false,
  currency = "INR",
}: LineChartProps) {
  const { primary, mutedForeground, border } = useChartColors();
  const lineColor = color ?? primary;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsLineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
        {showGrid && (
          <CartesianGrid strokeDasharray="3 3" stroke={border} />
        )}
        <XAxis
          dataKey={xAxisKey}
          tick={{ fontSize: 11, fill: mutedForeground }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: mutedForeground }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => formatCurrency(v, currency, true)}
        />
        <Tooltip
          content={({ payload, label }) => {
            if (!payload?.length) return null;
            return (
              <div className="rounded-lg bg-card border border-border/50 shadow-lg p-2 text-xs">
                <p className="text-muted-foreground">{label}</p>
                <p className="font-medium">
                  {formatCurrency(payload[0].value as number, currency)}
                </p>
              </div>
            );
          }}
        />
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke={lineColor}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </RechartsLineChart>
    </ResponsiveContainer>
  );
}
