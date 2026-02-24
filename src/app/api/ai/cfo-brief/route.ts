import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { generateWeeklyCfoBrief } from "@/lib/openai";

export async function GET() {
  try {
    const user = await requireUser();
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { currency: true },
    });
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const [transactions, investments, budgets] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          userId: user.id,
          date: { gte: weekAgo, lte: now },
          type: { in: ["income", "expense"] },
        },
        orderBy: { amount: "desc" },
        take: 200,
      }),
      prisma.investment.findMany({
        where: { userId: user.id },
      }),
      prisma.budget.findMany({
        where: { userId: user.id, month, year },
        include: { category: true },
      }),
    ]);

    const weeklyIncome = transactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const weeklyExpense = transactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const weeklySavings = weeklyIncome - weeklyExpense;
    const largestExpenses = transactions
      .filter((t) => t.type === "expense")
      .slice(0, 5)
      .map((t) => ({
        description: t.description || "Expense",
        amount: Number(t.amount),
      }));

    const upcomingPayments = budgets
      .slice(0, 5)
      .map((b) => ({
        name: `${b.category.name} budget`,
        amount: Number(b.amount),
        dueInDays: Math.max(0, 30 - now.getDate()),
      }));

    const investmentCost = investments.reduce(
      (sum, i) => sum + Number(i.avgBuyPrice) * Number(i.quantity),
      0
    );
    const investmentValue = investments.reduce(
      (sum, i) => sum + Number(i.currentPrice || i.avgBuyPrice) * Number(i.quantity),
      0
    );
    const portfolioChangePercent =
      investmentCost > 0 ? ((investmentValue - investmentCost) / investmentCost) * 100 : 0;

    const brief = await generateWeeklyCfoBrief({
      currency: dbUser?.currency || "INR",
      weeklyIncome,
      weeklyExpense,
      weeklySavings,
      largestExpenses,
      upcomingPayments,
      portfolioChangePercent,
    });

    return NextResponse.json({
      ...brief,
      metrics: {
        weeklyIncome,
        weeklyExpense,
        weeklySavings,
        portfolioChangePercent,
      },
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

