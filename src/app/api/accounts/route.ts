import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();
    const accounts = await prisma.account.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(accounts);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();

    const account = await prisma.account.create({
      data: {
        userId: user.id,
        name: body.name,
        type: body.type,
        balance: body.balance || 0,
        currency: body.currency || "INR",
        icon: body.icon,
        color: body.color,
        creditLimit:
          body.type === "credit_card" && typeof body.creditLimit === "number"
            ? body.creditLimit
            : null,
      },
    });

    return NextResponse.json(account, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
