import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();
    const goals = await prisma.goal.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(goals);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();

    const goal = await prisma.goal.create({
      data: {
        userId: user.id,
        name: body.name,
        targetAmount: body.targetAmount,
        currentAmount: body.currentAmount || 0,
        deadline: body.deadline ? new Date(body.deadline) : null,
        icon: body.icon,
        color: body.color,
      },
    });

    return NextResponse.json(goal, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
