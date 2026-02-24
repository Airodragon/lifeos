import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

function round(n: number) {
  return Math.round(n * 100) / 100;
}

export async function GET() {
  try {
    const user = await requireUser();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);

    const [investments, transactions] = await Promise.all([
      prisma.investment.findMany({
        where: { userId: user.id },
        select: {
          id: true,
          symbol: true,
          name: true,
          type: true,
          quantity: true,
          avgBuyPrice: true,
          currentPrice: true,
        },
      }),
      prisma.transaction.findMany({
        where: {
          userId: user.id,
          type: "expense",
          date: { gte: threeMonthsAgo },
        },
        include: { category: { select: { name: true } } },
      }),
    ]);

    const holdings = investments.map((inv) => {
      const quantity = Number(inv.quantity);
      const price = Number(inv.currentPrice ?? inv.avgBuyPrice);
      return {
        symbol: inv.symbol,
        name: inv.name,
        type: inv.type,
        value: quantity * price,
      };
    });

    const totalValue = holdings.reduce((sum, h) => sum + h.value, 0);
    const concentration = holdings
      .map((h) => ({
        ...h,
        weight: totalValue > 0 ? (h.value / totalValue) * 100 : 0,
      }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 5)
      .map((h) => ({
        symbol: h.symbol,
        name: h.name,
        type: h.type,
        value: round(h.value),
        weight: round(h.weight),
        riskLevel: h.weight >= 25 ? "high" : h.weight >= 15 ? "medium" : "low",
      }));

    const typeExposureMap = new Map<string, number>();
    for (const h of holdings) {
      typeExposureMap.set(h.type, (typeExposureMap.get(h.type) || 0) + h.value);
    }
    const typeExposure = Array.from(typeExposureMap.entries()).map(([type, value]) => ({
      type,
      value: round(value),
      weight: round(totalValue > 0 ? (value / totalValue) * 100 : 0),
    }));

    const thisMonthSpends = new Map<string, number>();
    const historicalMonthCategory = new Map<string, number>();

    for (const txn of transactions) {
      const category = txn.category?.name || "Other";
      const amount = Number(txn.amount);
      const tDate = new Date(txn.date);
      const key = `${tDate.getFullYear()}-${tDate.getMonth() + 1}`;

      if (tDate >= monthStart) {
        thisMonthSpends.set(category, (thisMonthSpends.get(category) || 0) + amount);
      }

      const monthKey = `${category}::${key}`;
      historicalMonthCategory.set(
        monthKey,
        (historicalMonthCategory.get(monthKey) || 0) + amount
      );
    }

    const anomalies = Array.from(thisMonthSpends.entries())
      .map(([category, thisMonthAmount]) => {
        const history = Array.from(historicalMonthCategory.entries())
          .filter(([monthKey]) => monthKey.startsWith(`${category}::`))
          .map(([, value]) => value);
        const avg = history.length > 0 ? history.reduce((s, v) => s + v, 0) / history.length : 0;
        const jumpPercent = avg > 0 ? ((thisMonthAmount - avg) / avg) * 100 : 0;
        return {
          category,
          current: round(thisMonthAmount),
          baseline: round(avg),
          jumpPercent: round(jumpPercent),
        };
      })
      .filter((row) => row.current > 0 && (row.jumpPercent >= 35 || row.current >= row.baseline + 3000))
      .sort((a, b) => b.jumpPercent - a.jumpPercent)
      .slice(0, 5);

    return NextResponse.json({
      concentration,
      typeExposure,
      anomalies,
      totals: {
        portfolioValue: round(totalValue),
        monthlyExpense: round(
          Array.from(thisMonthSpends.values()).reduce((sum, amount) => sum + amount, 0)
        ),
      },
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
