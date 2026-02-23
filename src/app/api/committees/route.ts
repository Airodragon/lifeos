import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();
    const committees = await prisma.committee.findMany({
      where: { userId: user.id },
      include: { payments: { orderBy: { month: "asc" } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(committees);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();

    const committee = await prisma.committee.create({
      data: {
        userId: user.id,
        name: body.name,
        totalAmount: body.totalAmount,
        monthlyAmount: body.monthlyAmount,
        totalMembers: body.totalMembers,
        startDate: new Date(body.startDate),
        duration: body.duration,
        payoutMonth: body.payoutMonth,
        payments: {
          createMany: {
            data: Array.from({ length: body.duration }, (_, i) => ({
              amount: body.monthlyAmount,
              month: i + 1,
              paid: false,
            })),
          },
        },
      },
      include: { payments: true },
    });

    return NextResponse.json(committee, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
