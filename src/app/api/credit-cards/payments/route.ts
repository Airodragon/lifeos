import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { z } from "zod";

const createSchema = z.object({
  creditCardAccountId: z.string().min(1),
  fromAccountId: z.string().min(1),
  amount: z.number().positive(),
  date: z.string().optional(),
  note: z.string().optional(),
});

function getOutstandingDue(balance: number, creditLimit: number | null): number {
  const limit = creditLimit ?? 0;
  if (limit > 0 && balance >= 0) {
    return Math.max(0, limit - balance);
  }
  return Math.max(0, -balance);
}

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const creditCardAccountId = searchParams.get("creditCardAccountId");
    const where: Record<string, unknown> = { userId: user.id };
    if (creditCardAccountId) where.creditCardAccountId = creditCardAccountId;

    const payments = await prisma.creditCardPayment.findMany({
      where,
      include: {
        fromAccount: { select: { id: true, name: true, type: true } },
        creditCardAccount: { select: { id: true, name: true, type: true } },
      },
      orderBy: { date: "desc" },
      take: 50,
    });

    return NextResponse.json(payments);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const data = createSchema.parse(body);

    if (data.fromAccountId === data.creditCardAccountId) {
      return NextResponse.json(
        { error: "Payment account and credit card must be different" },
        { status: 400 }
      );
    }

    const [fromAccount, cardAccount] = await Promise.all([
      prisma.account.findFirst({
        where: { id: data.fromAccountId, userId: user.id },
      }),
      prisma.account.findFirst({
        where: { id: data.creditCardAccountId, userId: user.id, type: "credit_card" },
      }),
    ]);

    if (!fromAccount) {
      return NextResponse.json({ error: "From account not found" }, { status: 400 });
    }
    if (fromAccount.type === "credit_card") {
      return NextResponse.json(
        { error: "From account must be a bank/wallet account" },
        { status: 400 }
      );
    }
    if (!cardAccount) {
      return NextResponse.json({ error: "Credit card not found" }, { status: 400 });
    }

    const outstandingDue = getOutstandingDue(
      Number(cardAccount.balance),
      cardAccount.creditLimit ? Number(cardAccount.creditLimit) : null
    );
    if (outstandingDue <= 0) {
      return NextResponse.json(
        { error: "This credit card has no outstanding due" },
        { status: 400 }
      );
    }
    if (data.amount - outstandingDue > 0.0001) {
      return NextResponse.json(
        {
          error: `Payment exceeds outstanding due (${outstandingDue.toFixed(2)})`,
          maxPayable: outstandingDue,
        },
        { status: 400 }
      );
    }

    const paymentDate = data.date ? new Date(data.date) : new Date();

    const payment = await prisma.$transaction(async (tx) => {
      await tx.account.update({
        where: { id: fromAccount.id },
        data: { balance: { decrement: data.amount } },
      });
      await tx.account.update({
        where: { id: cardAccount.id },
        data: { balance: { increment: data.amount } },
      });
      return tx.creditCardPayment.create({
        data: {
          userId: user.id,
          fromAccountId: fromAccount.id,
          creditCardAccountId: cardAccount.id,
          amount: data.amount,
          date: paymentDate,
          note: data.note,
        },
        include: {
          fromAccount: { select: { id: true, name: true, type: true } },
          creditCardAccount: { select: { id: true, name: true, type: true } },
        },
      });
    });

    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
