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
        payoutAmount: body.payoutAmount,
        totalMembers: body.totalMembers || body.duration,
        startDate: new Date(body.startDate),
        paymentDay: body.paymentDay || 1,
        duration: body.duration,
        notes: body.notes || null,
        payments: {
          createMany: {
            data: Array.from({ length: body.duration }, (_, i) => ({
              month: i + 1,
              amount: null,
              paid: false,
            })),
          },
        },
      },
      include: { payments: true },
    });

    return NextResponse.json(committee, { status: 201 });
  } catch (error) {
    console.error("Committee create error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
