import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();

    const [accounts, investments, offlineAssets, liabilities] =
      await Promise.all([
        prisma.account.findMany({ where: { userId: user.id } }),
        prisma.investment.findMany({ where: { userId: user.id } }),
        prisma.offlineAsset.findMany({ where: { userId: user.id } }),
        prisma.liability.findMany({ where: { userId: user.id } }),
      ]);

    const bankTotal = accounts.reduce(
      (sum, a) => sum + Number(a.balance),
      0
    );

    const investmentTotal = investments.reduce(
      (sum, i) =>
        sum + Number(i.currentPrice || i.avgBuyPrice) * Number(i.quantity),
      0
    );

    const investmentCost = investments.reduce(
      (sum, i) => sum + Number(i.avgBuyPrice) * Number(i.quantity),
      0
    );

    const offlineTotal = offlineAssets.reduce(
      (sum, a) => sum + Number(a.currentValue),
      0
    );

    const liabilityTotal = liabilities.reduce(
      (sum, l) => sum + Number(l.outstanding),
      0
    );

    const totalAssets = bankTotal + investmentTotal + offlineTotal;
    const netWorth = totalAssets - liabilityTotal;

    return NextResponse.json({
      netWorth,
      totalAssets,
      totalLiabilities: liabilityTotal,
      breakdown: {
        bankAccounts: bankTotal,
        investments: investmentTotal,
        investmentCost,
        investmentGain: investmentTotal - investmentCost,
        offlineAssets: offlineTotal,
      },
      liabilities: liabilities.map((l) => ({
        ...l,
        principal: Number(l.principal),
        outstanding: Number(l.outstanding),
        interestRate: Number(l.interestRate),
        emiAmount: l.emiAmount ? Number(l.emiAmount) : null,
      })),
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
