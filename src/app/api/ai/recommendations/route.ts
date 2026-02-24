import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateActionRecommendations } from "@/lib/openai";

export async function GET() {
  try {
    const user = await requireUser();
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [txns, investments, watchlist, priceAlerts] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId: user.id, deletedAt: null, date: { gte: start, lte: monthEnd } },
        include: { category: true },
      }),
      prisma.investment.findMany({
        where: { userId: user.id, deletedAt: null },
      }),
      prisma.watchlistItem.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "asc" },
      }),
      prisma.priceAlert.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    const monthIncome = txns
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const monthExpense = txns
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const savingsRate = monthIncome > 0 ? ((monthIncome - monthExpense) / monthIncome) * 100 : 0;

    const spendMap = new Map<string, number>();
    txns
      .filter((t) => t.type === "expense")
      .forEach((t) => {
        const key = t.category?.name || "Other";
        spendMap.set(key, (spendMap.get(key) || 0) + Number(t.amount));
      });
    const topSpends = Array.from(spendMap.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    const holdings = investments.map((inv) => {
      const value = Number(inv.quantity) * Number(inv.currentPrice || inv.avgBuyPrice);
      return { symbol: inv.symbol, value };
    });
    const total = holdings.reduce((sum, h) => sum + h.value, 0);
    const concentration = holdings
      .map((h) => ({
        symbol: h.symbol,
        weight: total > 0 ? (h.value / total) * 100 : 0,
        riskLevel: total > 0 && h.value / total > 0.3 ? "high" : total > 0 && h.value / total > 0.15 ? "medium" : "low",
      }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 6);

    const ai = await generateActionRecommendations({
      currency: "INR",
      monthIncome,
      monthExpense,
      savingsRate,
      concentration,
      topSpends,
      watchlist: watchlist.map((w) => w.symbol),
      priceAlerts: priceAlerts.map((p) => ({
        symbol: p.symbol,
        targetPrice: Number(p.targetPrice),
        direction: p.direction,
        status: p.status,
      })),
    });

    const payload = {
      ...ai,
      context: {
        monthIncome,
        monthExpense,
        savingsRate,
        watchlistCount: watchlist.length,
        activePriceAlerts: priceAlerts.filter((p) => p.status === "active").length,
      },
    };

    const latestSnapshot = await prisma.recommendationSnapshot.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, summary: true },
    });
    const shouldSnapshot =
      !latestSnapshot ||
      latestSnapshot.summary !== ai.summary ||
      Date.now() - latestSnapshot.createdAt.getTime() > 6 * 60 * 60 * 1000;

    if (shouldSnapshot) {
      await prisma.recommendationSnapshot.create({
        data: {
          userId: user.id,
          summary: ai.summary,
          payload,
        },
      });
    }

    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
