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

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = (await req.json().catch(() => ({}))) as { config?: Partial<AlertConfig> };
    const config = normalizeConfig(body.config);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const { start, end } = todayWindow();

    const trailing90Start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const [investments, budgets, monthExpenses, trailingExpenses, existingToday] = await Promise.all([
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
      prisma.transaction.findMany({
        where: {
          userId: user.id,
          type: "expense",
          deletedAt: null,
          date: { gte: trailing90Start },
        },
        include: { category: true },
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

    // Expense anomaly: today's spend vs trailing daily average.
    const todayExpenses = trailingExpenses.filter((txn) => txn.date >= start);
    const todayTotal = todayExpenses.reduce((sum, txn) => sum + Number(txn.amount), 0);
    const byDay = new Map<string, number>();
    for (const txn of trailingExpenses) {
      const key = startOfDay(txn.date).toISOString();
      byDay.set(key, (byDay.get(key) || 0) + Number(txn.amount));
    }
    const dailyValues = Array.from(byDay.values());
    const trailingDailyAvg =
      dailyValues.length > 0
        ? dailyValues.reduce((sum, v) => sum + v, 0) / dailyValues.length
        : 0;
    if (todayTotal > 0 && trailingDailyAvg > 0 && todayTotal >= trailingDailyAvg * 1.8) {
      const title = "Unusual spending today";
      if (!existingTitles.has(title)) {
        createQueue.push({
          title,
          message: `Today's spend is ${todayTotal.toFixed(0)}, about ${(todayTotal / trailingDailyAvg).toFixed(1)}x your usual daily average.`,
          type: "expense_alert",
          data: JSON.stringify({ todayTotal, trailingDailyAvg }),
        });
      }
    }

    // Category spike alert: this month category spend vs previous 3-month baseline.
    const currentMonthByCategory = new Map<string, { name: string; amount: number }>();
    const baselineByCategory = new Map<string, number>();
    const baselineWindowStart = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    for (const txn of trailingExpenses) {
      const categoryName = txn.category?.name || "Other";
      if (txn.date >= monthStart) {
        const existing = currentMonthByCategory.get(categoryName) || { name: categoryName, amount: 0 };
        existing.amount += Number(txn.amount);
        currentMonthByCategory.set(categoryName, existing);
      } else if (txn.date >= baselineWindowStart) {
        baselineByCategory.set(categoryName, (baselineByCategory.get(categoryName) || 0) + Number(txn.amount));
      }
    }
    for (const [categoryName, current] of currentMonthByCategory.entries()) {
      const baselineTotal = baselineByCategory.get(categoryName) || 0;
      const baselineMonthly = baselineTotal / 3;
      if (baselineMonthly <= 0) continue;
      const ratio = current.amount / baselineMonthly;
      if (ratio >= 1.4 && current.amount - baselineMonthly >= 1000) {
        const title = `Spike alert: ${categoryName}`;
        if (!existingTitles.has(title)) {
          createQueue.push({
            title,
            message: `${categoryName} spending is up ${(ratio * 100 - 100).toFixed(0)}% vs your recent monthly average.`,
            type: "expense_alert",
            data: JSON.stringify({ categoryName, current: current.amount, baselineMonthly }),
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
