import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

type RangeKey = "7d" | "30d" | "3m" | "1y";

function getStartDate(range: string) {
  const now = new Date();
  const d = new Date(now);
  if (range === "7d") d.setDate(now.getDate() - 7);
  else if (range === "30d") d.setDate(now.getDate() - 30);
  else if (range === "3m") d.setMonth(now.getMonth() - 3);
  else d.setFullYear(now.getFullYear() - 1);
  return d;
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const range = (searchParams.get("range") || "30d") as RangeKey;
    const startDate = getStartDate(range);

    const txns = await prisma.investmentTransaction.findMany({
      where: { userId: user.id, date: { gte: startDate } },
      orderBy: { date: "asc" },
    });

    const typeTotals = new Map<string, number>();
    const seriesMap = new Map<string, { invested: number; withdrawn: number; fees: number; net: number }>();

    for (const txn of txns) {
      const amount = Number(txn.amount);
      const d = new Date(txn.date);
      const key =
        range === "1y" || range === "3m"
          ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
          : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
              d.getDate()
            ).padStart(2, "0")}`;

      if (!seriesMap.has(key)) {
        seriesMap.set(key, { invested: 0, withdrawn: 0, fees: 0, net: 0 });
      }
      const slot = seriesMap.get(key)!;

      if (txn.type === "buy" || txn.type === "sip") {
        slot.invested += amount;
        slot.net -= amount;
      } else if (txn.type === "sell" || txn.type === "dividend") {
        slot.withdrawn += amount;
        slot.net += amount;
      } else if (txn.type === "fee") {
        slot.fees += amount;
        slot.net -= amount;
      }

      typeTotals.set(txn.type, (typeTotals.get(txn.type) || 0) + amount);
    }

    const cashflowSeries = Array.from(seriesMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, values]) => ({
        period,
        invested: round(values.invested),
        withdrawn: round(values.withdrawn),
        fees: round(values.fees),
        net: round(values.net),
      }));

    const typeBreakdown = Array.from(typeTotals.entries()).map(([type, value]) => ({
      name: type,
      value: round(value),
      color:
        type === "buy"
          ? "#3b82f6"
          : type === "sip"
            ? "#8b5cf6"
            : type === "sell"
              ? "#22c55e"
              : type === "dividend"
                ? "#14b8a6"
                : "#f97316",
    }));

    return NextResponse.json({
      range,
      cashflowSeries,
      typeBreakdown,
      totals: {
        invested: round(cashflowSeries.reduce((s, row) => s + row.invested, 0)),
        withdrawn: round(cashflowSeries.reduce((s, row) => s + row.withdrawn, 0)),
        fees: round(cashflowSeries.reduce((s, row) => s + row.fees, 0)),
        net: round(cashflowSeries.reduce((s, row) => s + row.net, 0)),
      },
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
