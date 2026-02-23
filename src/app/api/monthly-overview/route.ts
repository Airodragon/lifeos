import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));
    const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const prevStartDate = new Date(year, month - 2, 1);
    const prevEndDate = new Date(year, month - 1, 0, 23, 59, 59);

    const [currentTxns, prevTxns] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          userId: user.id,
          date: { gte: startDate, lte: endDate },
        },
        include: { category: true },
      }),
      prisma.transaction.findMany({
        where: {
          userId: user.id,
          date: { gte: prevStartDate, lte: prevEndDate },
        },
      }),
    ]);

    const income = currentTxns
      .filter((t) => t.type === "income")
      .reduce((s, t) => s + Number(t.amount), 0);
    const expense = currentTxns
      .filter((t) => t.type === "expense")
      .reduce((s, t) => s + Number(t.amount), 0);
    const savings = income - expense;

    const prevIncome = prevTxns
      .filter((t) => t.type === "income")
      .reduce((s, t) => s + Number(t.amount), 0);
    const prevExpense = prevTxns
      .filter((t) => t.type === "expense")
      .reduce((s, t) => s + Number(t.amount), 0);

    const categoryBreakdown: Record<string, { amount: number; color: string; name: string }> = {};
    currentTxns
      .filter((t) => t.type === "expense")
      .forEach((t) => {
        const name = t.category?.name || "Other";
        const color = t.category?.color || "#6b7280";
        if (!categoryBreakdown[name]) {
          categoryBreakdown[name] = { amount: 0, color, name };
        }
        categoryBreakdown[name].amount += Number(t.amount);
      });

    const topCategories = Object.values(categoryBreakdown)
      .sort((a, b) => b.amount - a.amount);

    // Daily spending for the month
    const dailySpending: Record<number, number> = {};
    currentTxns
      .filter((t) => t.type === "expense")
      .forEach((t) => {
        const day = new Date(t.date).getDate();
        dailySpending[day] = (dailySpending[day] || 0) + Number(t.amount);
      });

    const daysInMonth = new Date(year, month, 0).getDate();
    const dailyData = Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1,
      amount: dailySpending[i + 1] || 0,
    }));

    const avgDailySpend = expense / (new Date().getDate());
    const projectedMonthly = avgDailySpend * daysInMonth;

    return NextResponse.json({
      month,
      year,
      income,
      expense,
      savings,
      savingsRate: income > 0 ? ((savings / income) * 100) : 0,
      prevIncome,
      prevExpense,
      incomeChange: prevIncome > 0 ? ((income - prevIncome) / prevIncome) * 100 : 0,
      expenseChange: prevExpense > 0 ? ((expense - prevExpense) / prevExpense) * 100 : 0,
      topCategories,
      dailyData,
      transactionCount: currentTxns.length,
      avgDailySpend,
      projectedMonthly,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
