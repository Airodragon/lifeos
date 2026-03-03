import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Monthly cron: runs on the 1st of each month at ~00:30 IST.
 * For each budget row marked `rollover = true`, if last month's budget
 * was under-spent, carry the surplus forward into this month's budget.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const thisMonth = now.getMonth() + 1;
    const thisYear = now.getFullYear();
    const lastMonth = thisMonth === 1 ? 12 : thisMonth - 1;
    const lastYear = thisMonth === 1 ? thisYear - 1 : thisYear;

    // Find all budgets from last month that have rollover enabled
    const lastMonthBudgets = await prisma.budget.findMany({
      where: { month: lastMonth, year: lastYear, rollover: true },
    });

    let rolledOver = 0;
    let skipped = 0;

    for (const budget of lastMonthBudgets) {
      // Calculate spending for last month in this category
      const startOfLastMonth = new Date(lastYear, lastMonth - 1, 1);
      const endOfLastMonth = new Date(lastYear, lastMonth, 0, 23, 59, 59, 999);

      const spending = await prisma.transaction.aggregate({
        _sum: { amount: true },
        where: {
          userId: budget.userId,
          categoryId: budget.categoryId,
          type: "expense",
          date: { gte: startOfLastMonth, lte: endOfLastMonth },
          deletedAt: null,
        },
      });

      const spent = Number(spending._sum.amount || 0);
      const surplus = Number(budget.amount) - spent;

      if (surplus <= 0) {
        skipped++;
        continue;
      }

      // Upsert this month's budget — add the surplus to any existing budget
      const existing = await prisma.budget.findUnique({
        where: {
          userId_categoryId_month_year: {
            userId: budget.userId,
            categoryId: budget.categoryId,
            month: thisMonth,
            year: thisYear,
          },
        },
      });

      if (existing) {
        await prisma.budget.update({
          where: { id: existing.id },
          data: { amount: Number(existing.amount) + surplus, rollover: true },
        });
      } else {
        await prisma.budget.create({
          data: {
            userId: budget.userId,
            categoryId: budget.categoryId,
            month: thisMonth,
            year: thisYear,
            amount: surplus,
            rollover: true,
          },
        });
      }
      rolledOver++;
    }

    return NextResponse.json({ rolledOver, skipped });
  } catch (error) {
    console.error("Budget rollover cron error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
