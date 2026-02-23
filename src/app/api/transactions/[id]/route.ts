import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const transaction = await prisma.transaction.findFirst({
      where: { id, userId: user.id },
      include: { category: true, account: true },
    });
    if (!transaction) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(transaction);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await req.json();

    const existing = await prisma.transaction.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const transaction = await prisma.transaction.update({
      where: { id },
      data: {
        amount: body.amount,
        type: body.type,
        description: body.description,
        date: body.date ? new Date(body.date) : undefined,
        categoryId: body.categoryId,
        accountId: body.accountId,
        tags: body.tags,
      },
      include: { category: true, account: true },
    });

    return NextResponse.json(transaction);
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const existing = await prisma.transaction.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.transaction.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
