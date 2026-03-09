import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { parseDateInputAsIST } from "@/lib/utils";
import { z } from "zod";

const updateSchema = z.object({
  amount: z.number().positive().optional(),
  type: z.enum(["income", "expense", "transfer"]).optional(),
  description: z.string().optional(),
  date: z.string().optional(),
  categoryId: z.string().nullable().optional(),
  accountId: z.string().nullable().optional(),
  toAccountId: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
});

function accountDelta(type: string, amount: number) {
  return type === "income" ? amount : -amount;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const transaction = await prisma.transaction.findFirst({
      where: { id, userId: user.id, deletedAt: null },
      include: { category: true, account: true, toAccount: true },
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
    const data = updateSchema.parse(body);

    const existing = await prisma.transaction.findFirst({
      where: { id, userId: user.id, deletedAt: null },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const nextAmount = data.amount ?? Number(existing.amount);
    const nextType = data.type ?? existing.type;
    const nextAccountId =
      data.accountId === undefined
        ? existing.accountId
        : data.accountId || null;

    const nextToAccountId =
      data.toAccountId === undefined
        ? existing.toAccountId
        : data.toAccountId || null;

    if (nextAccountId) {
      const target = await prisma.account.findFirst({
        where: { id: nextAccountId, userId: user.id },
        select: { id: true },
      });
      if (!target) {
        return NextResponse.json({ error: "Account not found" }, { status: 400 });
      }
    }

    if (nextToAccountId && nextType === "transfer") {
      const targetTo = await prisma.account.findFirst({
        where: { id: nextToAccountId, userId: user.id },
        select: { id: true },
      });
      if (!targetTo) {
        return NextResponse.json({ error: "Destination account not found" }, { status: 400 });
      }
    }

    const transaction = await prisma.$transaction(async (tx) => {
      // Revert old balances
      if (existing.accountId) {
        await tx.account.update({
          where: { id: existing.accountId },
          data: { balance: { increment: -accountDelta(existing.type, Number(existing.amount)) } },
        });
      }
      if (existing.toAccountId && existing.type === "transfer") {
        await tx.account.update({
          where: { id: existing.toAccountId },
          // A transfer adds to destination. To revert, we subtract.
          data: { balance: { increment: -Number(existing.amount) } },
        });
      }

      // Apply new balances
      if (nextAccountId) {
        await tx.account.update({
          where: { id: nextAccountId },
          data: { balance: { increment: accountDelta(nextType, nextAmount) } },
        });
      }
      if (nextToAccountId && nextType === "transfer") {
        await tx.account.update({
          where: { id: nextToAccountId },
          // A transfer adds to destination.
          data: { balance: { increment: nextAmount } },
        });
      }

      return tx.transaction.update({
        where: { id },
        data: {
          amount: nextAmount,
          type: nextType,
          description: data.description,
          date: data.date ? parseDateInputAsIST(data.date) : undefined,
          categoryId:
            data.categoryId === undefined ? existing.categoryId : data.categoryId,
          accountId: nextAccountId,
          toAccountId: nextType === "transfer" ? nextToAccountId : null,
          tags: data.tags,
        },
        include: { category: true, account: true, toAccount: true },
      });
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
      where: { id, userId: user.id, deletedAt: null },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      if (existing.accountId) {
        await tx.account.update({
          where: { id: existing.accountId },
          data: {
            balance: {
              increment: -accountDelta(existing.type, Number(existing.amount)),
            },
          },
        });
      }
      if (existing.toAccountId && existing.type === "transfer") {
        await tx.account.update({
          where: { id: existing.toAccountId },
          data: {
            balance: {
              increment: -Number(existing.amount),
            },
          },
        });
      }
      await tx.transaction.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
