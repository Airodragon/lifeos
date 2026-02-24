import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { recomputeInvestmentFromLedger } from "@/lib/investment-ledger";

const createTxnSchema = z.object({
  type: z.enum(["buy", "sell", "sip", "dividend", "fee"]),
  quantity: z.number().optional(),
  price: z.number().optional(),
  amount: z.number(),
  fees: z.number().optional(),
  taxes: z.number().optional(),
  note: z.string().optional(),
  date: z.string(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const investment = await prisma.investment.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });
    if (!investment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const txns = await prisma.investmentTransaction.findMany({
      where: { userId: user.id, investmentId: id },
      orderBy: { date: "desc" },
    });
    return NextResponse.json(txns);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const investment = await prisma.investment.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });
    if (!investment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const data = createTxnSchema.parse(body);

    const txn = await prisma.investmentTransaction.create({
      data: {
        userId: user.id,
        investmentId: id,
        type: data.type,
        quantity: data.quantity,
        price: data.price,
        amount: data.amount,
        fees: data.fees || 0,
        taxes: data.taxes || 0,
        note: data.note,
        date: new Date(data.date),
      },
    });

    await recomputeInvestmentFromLedger(user.id, id);

    return NextResponse.json(txn, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const { transactionId } = await req.json();
    const txn = await prisma.investmentTransaction.findFirst({
      where: { id: transactionId, userId: user.id, investmentId: id },
      select: { id: true },
    });
    if (!txn) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await prisma.investmentTransaction.delete({ where: { id: transactionId } });
    await recomputeInvestmentFromLedger(user.id, id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

