import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createNotificationAndPush } from "@/lib/notifications";

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

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { start, end } = todayWindow();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const trailing90Start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  try {
    const users = await prisma.user.findMany({ select: { id: true } });
    let generated = 0;

    for (const user of users) {
      const [budgets, monthExpenses, trailingExpenses, existingToday] = await Promise.all([
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

      for (const b of budgets) {
        const spent = monthExpenses
          .filter((txn) => txn.categoryId === b.categoryId)
          .reduce((sum, txn) => sum + Number(txn.amount), 0);
        const budgetAmount = Number(b.amount);
        const usage = budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0;
        if (usage >= 90) {
          const title = `Budget alert: ${b.category?.name || "Category"}`;
          if (!existingTitles.has(title)) {
            await createNotificationAndPush({
              userId: user.id,
              title,
              message: `${b.category?.name || "Budget"} is at ${usage.toFixed(0)}% usage this month.`,
              type: "budget_alert",
              data: { categoryId: b.categoryId, usage },
              url: "/budgets",
            });
            generated++;
          }
        }
      }

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
      const todayTotal = trailingExpenses
        .filter((txn) => txn.date >= start)
        .reduce((sum, txn) => sum + Number(txn.amount), 0);
      if (todayTotal > 0 && trailingDailyAvg > 0 && todayTotal >= trailingDailyAvg * 1.8) {
        const title = "Unusual spending today";
        if (!existingTitles.has(title)) {
          await createNotificationAndPush({
            userId: user.id,
            title,
            message: `Today's spend is ${todayTotal.toFixed(0)}, around ${(todayTotal / trailingDailyAvg).toFixed(1)}x your usual daily average.`,
            type: "expense_alert",
            data: { todayTotal, trailingDailyAvg },
            url: "/expenses",
          });
          generated++;
        }
      }
    }

    return NextResponse.json({ generated, users: users.length });
  } catch (error) {
    console.error("Alert cron failed:", error);
    return NextResponse.json({ error: "Failed to evaluate alerts" }, { status: 500 });
  }
}
