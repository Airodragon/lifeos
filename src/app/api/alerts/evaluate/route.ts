import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { createNotificationAndPush } from "@/lib/notifications";

type AlertConfig = {
  concentrationThreshold: number;
  budgetUsageThreshold: number;
  drawdownThreshold: number;
};

const DEFAULT_CONFIG: AlertConfig = {
  concentrationThreshold: 25,
  budgetUsageThreshold: 90,
  drawdownThreshold: 8,
};

function normalizeConfig(raw?: Partial<AlertConfig>): AlertConfig {
  return {
    concentrationThreshold: raw?.concentrationThreshold ?? DEFAULT_CONFIG.concentrationThreshold,
    budgetUsageThreshold: raw?.budgetUsageThreshold ?? DEFAULT_CONFIG.budgetUsageThreshold,
    drawdownThreshold: raw?.drawdownThreshold ?? DEFAULT_CONFIG.drawdownThreshold,
  };
}

function todayWindow() {
  const now = new Date();
  return {
    start: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
    end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999),
  };
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = (await req.json().catch(() => ({}))) as { config?: Partial<AlertConfig> };
    const config = normalizeConfig(body.config);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const { start, end } = todayWindow();

    const [investments, budgets, monthExpenses, existingToday] = await Promise.all([
      prisma.investment.findMany({ where: { userId: user.id, deletedAt: null } }),
      prisma.budget.findMany({
        where: { userId: user.id, month: now.getMonth() + 1, year: now.getFullYear() },
        include: { category: true },
      }),
      prisma.transaction.findMany({
        where: {
          userId: user.id,
          type: "expense",
          deletedAt: null,
          date: { gte: monthStart },
        },
      }),
      prisma.notification.findMany({
        where: { userId: user.id, createdAt: { gte: start, lte: end } },
        select: { title: true },
      }),
    ]);

    const existingTitles = new Set(existingToday.map((n) => n.title));
    const createQueue: Array<{ title: string; message: string; type: string; data?: string }> = [];

    const holdings = investments.map((inv) => {
      const value = Number(inv.quantity) * Number(inv.currentPrice ?? inv.avgBuyPrice);
      const gainPercent =
        Number(inv.avgBuyPrice) > 0 && Number(inv.currentPrice ?? inv.avgBuyPrice) > 0
          ? ((Number(inv.currentPrice ?? inv.avgBuyPrice) - Number(inv.avgBuyPrice)) /
              Number(inv.avgBuyPrice)) *
            100
          : 0;
      return { symbol: inv.symbol, value, gainPercent };
    });
    const portfolioValue = holdings.reduce((sum, h) => sum + h.value, 0);

    for (const h of holdings) {
      const weight = portfolioValue > 0 ? (h.value / portfolioValue) * 100 : 0;
      if (weight >= config.concentrationThreshold) {
        const title = `Concentration alert: ${h.symbol}`;
        if (!existingTitles.has(title)) {
          createQueue.push({
            title,
            message: `${h.symbol} is ${weight.toFixed(1)}% of your portfolio, above your ${config.concentrationThreshold}% threshold.`,
            type: "investment_alert",
            data: JSON.stringify({ symbol: h.symbol, weight }),
          });
        }
      }
      if (h.gainPercent <= -Math.abs(config.drawdownThreshold)) {
        const title = `Drawdown alert: ${h.symbol}`;
        if (!existingTitles.has(title)) {
          createQueue.push({
            title,
            message: `${h.symbol} is down ${Math.abs(h.gainPercent).toFixed(1)}% vs average buy price.`,
            type: "investment_alert",
            data: JSON.stringify({ symbol: h.symbol, drawdown: h.gainPercent }),
          });
        }
      }
    }

    for (const b of budgets) {
      const spent = monthExpenses
        .filter((txn) => txn.categoryId === b.categoryId)
        .reduce((sum, txn) => sum + Number(txn.amount), 0);
      const budgetAmount = Number(b.amount);
      const usage = budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0;
      if (usage >= config.budgetUsageThreshold) {
        const title = `Budget alert: ${b.category?.name || "Category"}`;
        if (!existingTitles.has(title)) {
          createQueue.push({
            title,
            message: `${(b.category?.name || "Budget")} is at ${usage.toFixed(0)}% usage this month.`,
            type: "budget_alert",
            data: JSON.stringify({ categoryId: b.categoryId, usage }),
          });
        }
      }
    }

    for (const item of createQueue) {
      await createNotificationAndPush({
        userId: user.id,
        title: item.title,
        message: item.message,
        type: item.type,
        data: item.data ? JSON.parse(item.data) : undefined,
        url: "/notifications",
      });
    }

    return NextResponse.json({
      config,
      generated: createQueue.length,
      alerts: createQueue,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
