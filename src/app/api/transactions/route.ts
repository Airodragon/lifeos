import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { istDayEnd, istDayStart, parseDateInputAsIST } from "@/lib/utils";
import { z } from "zod";

const createSchema = z.object({
  amount: z.number().positive(),
  type: z.enum(["income", "expense", "transfer"]),
  description: z.string().optional(),
  date: z.string(),
  categoryId: z.string().optional(),
  accountId: z.string().optional(),
  toAccountId: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

function accountDelta(type: string, amount: number) {
  return type === "income" ? amount : -amount;
}

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const type = searchParams.get("type");
    const categoryId = searchParams.get("categoryId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const q = searchParams.get("q")?.trim();

    const where: Record<string, unknown> = { userId: user.id, deletedAt: null };
    if (type) where.type = type;
    if (categoryId) where.categoryId = categoryId;
    if (startDate || endDate) {
      where.date = {
        ...(startDate && { gte: istDayStart(startDate) }),
        ...(endDate && { lte: istDayEnd(endDate) }),
      };
    }
    if (q) {
      where.OR = [
        { description: { contains: q, mode: "insensitive" } },
        { category: { name: { contains: q, mode: "insensitive" } } },
        { account: { name: { contains: q, mode: "insensitive" } } },
      ];
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: { category: true, account: true, toAccount: true },
        orderBy: { date: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.transaction.count({ where }),
    ]);

    return NextResponse.json({ transactions, total, page, limit });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const data = createSchema.parse(body);
    if (data.accountId) {
      const account = await prisma.account.findFirst({
        where: { id: data.accountId, userId: user.id },
        select: { id: true },
      });
      if (!account) {
        return NextResponse.json({ error: "Account not found" }, { status: 400 });
      }
    }
    if (data.toAccountId && data.type === "transfer") {
      const toAccount = await prisma.account.findFirst({
        where: { id: data.toAccountId, userId: user.id },
        select: { id: true },
      });
      if (!toAccount) {
        return NextResponse.json({ error: "Destination account not found" }, { status: 400 });
      }
    }
    const transaction = await prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data: {
          userId: user.id,
          amount: data.amount,
          type: data.type,
          description: data.description,
          date: parseDateInputAsIST(data.date),
          categoryId: data.categoryId,
          accountId: data.accountId,
          toAccountId: data.type === "transfer" ? data.toAccountId : undefined,
          tags: data.tags || [],
        },
        include: { category: true, account: true, toAccount: true },
      });

      if (data.accountId) {
        await tx.account.update({
          where: { id: data.accountId },
          data: { balance: { increment: accountDelta(data.type, data.amount) } },
        });
      }
      if (data.toAccountId && data.type === "transfer") {
        await tx.account.update({
          where: { id: data.toAccountId },
          // A transfer deducts from the source (expense) and adds to the destination (income).
          // But our POST type is "transfer". accountDelta returns -amount for transfers.
          // The source account was reduced by `amount`. 
          // The destination account should be increased by `amount`.
          data: { balance: { increment: data.amount } },
        });
      }
      return created;
    });
    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
