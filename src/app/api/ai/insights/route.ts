import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateFinancialInsights } from "@/lib/openai";

export async function GET() {
  try {
    const user = await requireUser();
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [txns, budgets, investments] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId: user.id, date: { gte: start, lte: monthEnd } },
        include: { category: true },
      }),
      prisma.budget.findMany({
        where: { userId: user.id, month: now.getMonth() + 1, year: now.getFullYear() },
        include: { category: true },
      }),
      prisma.investment.findMany({ where: { userId: user.id } }),
    ]);

    const monthIncome = txns
      .filter((t) => t.type === "income")
      .reduce((s, t) => s + Number(t.amount), 0);
    const monthExpense = txns
      .filter((t) => t.type === "expense")
      .reduce((s, t) => s + Number(t.amount), 0);
    const savingsRate = monthIncome > 0 ? ((monthIncome - monthExpense) / monthIncome) * 100 : 0;

    const categorySpend: Record<string, number> = {};
    txns
      .filter((t) => t.type === "expense")
      .forEach((t) => {
        const name = t.category?.name || "Other";
        categorySpend[name] = (categorySpend[name] || 0) + Number(t.amount);
      });
    const topCategories = Object.entries(categorySpend)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    const upcomingBills = budgets
      .map((b) => {
        const spent = txns
          .filter((t) => t.type === "expense" && t.categoryId === b.categoryId)
          .reduce((s, t) => s + Number(t.amount), 0);
        const remaining = Math.max(0, Number(b.amount) - spent);
        return {
          name: b.category?.name || "Budget",
          amount: remaining,
          dueInDays: Math.max(0, monthEnd.getDate() - now.getDate()),
        };
      })
      .filter((b) => b.amount > 0)
      .slice(0, 5);

    const totalInvestmentValue = investments.reduce(
      (s, i) => s + Number(i.currentPrice || i.avgBuyPrice) * Number(i.quantity),
      0
    );
    const totalInvestmentCost = investments.reduce(
      (s, i) => s + Number(i.avgBuyPrice) * Number(i.quantity),
      0
    );
    const investmentGainPercent =
      totalInvestmentCost > 0
        ? ((totalInvestmentValue - totalInvestmentCost) / totalInvestmentCost) * 100
        : 0;

    const insights = await generateFinancialInsights({
      currency: "INR",
      monthIncome,
      monthExpense,
      savingsRate,
      topCategories,
      upcomingBills,
      investments: { totalValue: totalInvestmentValue, gainPercent: investmentGainPercent },
    });

    return NextResponse.json(insights);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
