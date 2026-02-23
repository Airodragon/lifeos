import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { z } from "zod";

function calculateMaturity(
  principal: number,
  ratePercent: number,
  compounding: string,
  startDate: Date,
  maturityDate: Date
): number {
  const years = (maturityDate.getTime() - startDate.getTime()) / (365.25 * 86400000);
  let n: number;
  switch (compounding) {
    case "monthly": n = 12; break;
    case "quarterly": n = 4; break;
    case "half_yearly": n = 2; break;
    case "yearly": n = 1; break;
    default: n = 4;
  }
  const r = ratePercent / 100;
  return principal * Math.pow(1 + r / n, n * years);
}

const createSchema = z.object({
  bankName: z.string().min(1),
  accountNumber: z.string().optional(),
  principal: z.number().positive(),
  interestRate: z.number().positive(),
  compounding: z.enum(["monthly", "quarterly", "half_yearly", "yearly"]).optional(),
  startDate: z.string(),
  maturityDate: z.string(),
  isAutoRenew: z.boolean().optional(),
  notes: z.string().optional(),
});

export async function GET() {
  try {
    const user = await requireUser();
    const fds = await prisma.fixedDeposit.findMany({
      where: { userId: user.id },
      orderBy: { maturityDate: "asc" },
    });
    return NextResponse.json(fds);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const data = createSchema.parse(body);

    const start = new Date(data.startDate);
    const maturity = new Date(data.maturityDate);
    const compounding = data.compounding || "quarterly";

    const maturityAmount = calculateMaturity(
      data.principal,
      data.interestRate,
      compounding,
      start,
      maturity
    );

    const fd = await prisma.fixedDeposit.create({
      data: {
        userId: user.id,
        bankName: data.bankName,
        accountNumber: data.accountNumber || null,
        principal: data.principal,
        interestRate: data.interestRate,
        compounding,
        startDate: start,
        maturityDate: maturity,
        maturityAmount: Math.round(maturityAmount * 100) / 100,
        isAutoRenew: data.isAutoRenew || false,
        notes: data.notes || null,
      },
    });

    return NextResponse.json(fd, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
