import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export async function GET() {
  try {
    const user = await requireUser();
    const now = new Date();
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(now.getMonth() - 6);

    const [goals, txns] = await Promise.all([
      prisma.goal.findMany({
        where: { userId: user.id },
      }),
      prisma.transaction.findMany({
        where: {
          userId: user.id,
          date: { gte: sixMonthsAgo },
          type: { in: ["income", "expense"] },
        },
        select: { amount: true, type: true, date: true },
      }),
    ]);

    const activeGoals = goals.filter((g) => g.status === "active");
    const monthlyMap = new Map<string, { income: number; expense: number }>();
    for (const t of txns) {
      const d = new Date(t.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthlyMap.has(key)) monthlyMap.set(key, { income: 0, expense: 0 });
      const slot = monthlyMap.get(key)!;
      if (t.type === "income") slot.income += Number(t.amount);
      else slot.expense += Number(t.amount);
    }

    const monthlySavings = Array.from(monthlyMap.values()).map(
      (m) => m.income - m.expense
    );
    const avgMonthlySavings = monthlySavings.length
      ? monthlySavings.reduce((s, v) => s + v, 0) / monthlySavings.length
      : 0;
    const perGoalAllocation =
      activeGoals.length > 0 ? Math.max(avgMonthlySavings, 0) / activeGoals.length : 0;

    const projections = goals.map((g) => {
      const target = Number(g.targetAmount);
      const current = Number(g.currentAmount);
      const remaining = Math.max(target - current, 0);
      const deadline = g.deadline ? new Date(g.deadline) : null;
      const monthsLeft = deadline
        ? Math.max((deadline.getTime() - now.getTime()) / (30 * 86400000), 0)
        : 0;
      const monthlyRequired =
        monthsLeft > 0 && remaining > 0 ? remaining / monthsLeft : 0;
      const projectedAtDeadline =
        monthsLeft > 0 ? current + perGoalAllocation * monthsLeft : current;
      const probability = target > 0 ? clamp((projectedAtDeadline / target) * 100, 0, 100) : 100;

      return {
        goalId: g.id,
        monthlyRequired,
        monthsLeft,
        projectedAtDeadline,
        probability,
        status:
          probability >= 85
            ? "on_track"
            : probability >= 60
              ? "at_risk"
              : "off_track",
      };
    });

    return NextResponse.json({
      avgMonthlySavings,
      perGoalAllocation,
      projections,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

