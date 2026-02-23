"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency } from "@/lib/utils";

interface DonutChartProps {
  data: { name: string; value: number; color: string }[];
  innerLabel?: string;
  innerValue?: string;
  height?: number;
}

export function DonutChart({
  data,
  innerLabel,
  innerValue,
  height = 200,
}: DonutChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius="60%"
            outerRadius="85%"
            paddingAngle={2}
            dataKey="value"
            strokeWidth={0}
          >
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            content={({ payload }) => {
              if (!payload?.length) return null;
              const item = payload[0];
              return (
                <div className="rounded-lg bg-card border border-border/50 shadow-lg p-2 text-xs">
                  <p className="font-medium">{item.name}</p>
                  <p className="text-muted-foreground">
                    {formatCurrency(item.value as number)} (
                    {((item.value as number / total) * 100).toFixed(1)}%)
                  </p>
                </div>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      {(innerLabel || innerValue) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {innerValue && (
            <span className="text-lg font-bold">{innerValue}</span>
          )}
          {innerLabel && (
            <span className="text-xs text-muted-foreground">{innerLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}
