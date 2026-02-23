import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));
    const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));

    const budgets = await prisma.budget.findMany({
      where: { userId: user.id, month, year },
      include: { category: true },
    });

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const spending = await prisma.transaction.groupBy({
      by: ["categoryId"],
      where: {
        userId: user.id,
        type: "expense",
        date: { gte: startDate, lte: endDate },
      },
      _sum: { amount: true },
    });

    const spendingMap = new Map(
      spending.map((s) => [s.categoryId, Number(s._sum.amount || 0)])
    );

    const result = budgets.map((b) => ({
      ...b,
      amount: Number(b.amount),
      spent: spendingMap.get(b.categoryId) || 0,
    }));

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();

    const budget = await prisma.budget.upsert({
      where: {
        userId_categoryId_month_year: {
          userId: user.id,
          categoryId: body.categoryId,
          month: body.month,
          year: body.year,
        },
      },
      update: { amount: body.amount },
      create: {
        userId: user.id,
        categoryId: body.categoryId,
        amount: body.amount,
        month: body.month,
        year: body.year,
      },
      include: { category: true },
    });

    return NextResponse.json(budget, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
