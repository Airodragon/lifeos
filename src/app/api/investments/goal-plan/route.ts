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
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(now.getMonth() - 6);

    const [goals, investments, transactions] = await Promise.all([
      prisma.goal.findMany({
        where: { userId: user.id, status: "active" },
        orderBy: { createdAt: "asc" },
      }),
      prisma.investment.findMany({
        where: { userId: user.id },
      }),
      prisma.transaction.findMany({
        where: {
          userId: user.id,
          date: { gte: sixMonthsAgo },
          type: { in: ["income", "expense"] },
        },
      }),
    ]);

    const portfolioValue = investments.reduce((sum, inv) => {
      return sum + Number(inv.quantity) * Number(inv.currentPrice ?? inv.avgBuyPrice);
    }, 0);

    const monthMap = new Map<string, { income: number; expense: number }>();
    for (const txn of transactions) {
      const d = new Date(txn.date);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      if (!monthMap.has(key)) {
        monthMap.set(key, { income: 0, expense: 0 });
      }
      const slot = monthMap.get(key)!;
      if (txn.type === "income") slot.income += Number(txn.amount);
      if (txn.type === "expense") slot.expense += Number(txn.amount);
    }
    const monthlyTrend = Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, val]) => ({
        month,
        income: round(val.income),
        expense: round(val.expense),
        savings: round(val.income - val.expense),
      }));
    const monthlySavings = monthlyTrend.map((m) => m.savings);
    const avgMonthlySavings =
      monthlySavings.length > 0
        ? monthlySavings.reduce((sum, s) => sum + s, 0) / monthlySavings.length
        : 0;
    const investableMonthly = Math.max(0, avgMonthlySavings);

    const goalPlans = goals.map((goal) => {
      const target = Number(goal.targetAmount);
      const current = Number(goal.currentAmount);
      const remaining = Math.max(0, target - current);
      const monthsLeft = goal.deadline
        ? Math.max(1, (new Date(goal.deadline).getTime() - now.getTime()) / (30 * 86400000))
        : 60;
      const monthlyRequired = remaining / monthsLeft;
      const assumedAnnualReturn = 12;
      const assumedMonthlyReturn = assumedAnnualReturn / 12 / 100;
      const projected = current + investableMonthly * monthsLeft;
      const projectedWithReturns =
        current * Math.pow(1 + assumedMonthlyReturn, monthsLeft) +
        investableMonthly *
          ((Math.pow(1 + assumedMonthlyReturn, monthsLeft) - 1) / assumedMonthlyReturn);
      const shortfall = Math.max(0, target - projectedWithReturns);

      return {
        goalId: goal.id,
        name: goal.name,
        target: round(target),
        current: round(current),
        remaining: round(remaining),
        monthsLeft: round(monthsLeft),
        monthlyRequired: round(monthlyRequired),
        projectedAtDeadline: round(projectedWithReturns),
        shortfall: round(shortfall),
        status:
          projectedWithReturns >= target
            ? "on_track"
            : projected >= target * 0.85
              ? "at_risk"
              : "off_track",
      };
    });

    const goalMix = goalPlans.map((goal) => ({
      name: goal.name,
      target: goal.target,
      current: goal.current,
      projected: goal.projectedAtDeadline,
      shortfall: goal.shortfall,
    }));

    return NextResponse.json({
      portfolioValue: round(portfolioValue),
      avgMonthlySavings: round(avgMonthlySavings),
      investableMonthly: round(investableMonthly),
      goalPlans,
      monthlyTrend,
      goalMix,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
