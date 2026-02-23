import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();
    const liabilities = await prisma.liability.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(liabilities);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();

    const liability = await prisma.liability.create({
      data: {
        userId: user.id,
        name: body.name,
        type: body.type,
        principal: body.principal,
        outstanding: body.outstanding || body.principal,
        interestRate: body.interestRate,
        emiAmount: body.emiAmount,
        startDate: new Date(body.startDate),
        endDate: body.endDate ? new Date(body.endDate) : null,
      },
    });

    return NextResponse.json(liability, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
