import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

const COMPOUNDING_N: Record<string, number> = {
  monthly: 12,
  quarterly: 4,
  half_yearly: 2,
  yearly: 1,
};

function getCurrentFDValue(
  principal: number,
  ratePercent: number,
  compounding: string,
  startDate: Date
) {
  const years = Math.max(
    0,
    (Date.now() - startDate.getTime()) / (365.25 * 86400000)
  );
  const n = COMPOUNDING_N[compounding] || 4;
  const r = ratePercent / 100;
  return principal * Math.pow(1 + r / n, n * years);
}

export async function GET() {
  try {
    const user = await requireUser();

    const [accounts, investments, offlineAssets, liabilities, sips, fixedDeposits] =
      await Promise.all([
        prisma.account.findMany({ where: { userId: user.id } }),
        prisma.investment.findMany({ where: { userId: user.id, deletedAt: null } }),
        prisma.offlineAsset.findMany({ where: { userId: user.id } }),
        prisma.liability.findMany({ where: { userId: user.id } }),
        prisma.sIP.findMany({ where: { userId: user.id } }),
        prisma.fixedDeposit.findMany({ where: { userId: user.id } }),
      ]);

    const bankTotal = accounts
      .filter((a) => a.type !== "credit_card")
      .reduce((sum, a) => sum + Number(a.balance), 0);

    const creditCardDue = accounts
      .filter((a) => a.type === "credit_card")
      .reduce((sum, a) => sum + Math.abs(Number(a.balance)), 0);

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

    const sipCurrentTotal = sips.reduce(
      (sum, s) => sum + Number(s.currentValue || 0),
      0
    );

    const fdCurrentTotal = fixedDeposits.reduce((sum, fd) => {
      if (fd.status === "matured") return sum + Number(fd.maturityAmount);
      return (
        sum +
        getCurrentFDValue(
          Number(fd.principal),
          Number(fd.interestRate),
          fd.compounding,
          fd.startDate
        )
      );
    }, 0);

    const liabilityLoans = liabilities.reduce(
      (sum, l) => sum + Number(l.outstanding),
      0
    );

    const totalLiabilities = creditCardDue + liabilityLoans;

    // Net worth formula requested:
    // bank + SIP(current) + investments + FD(current) + offline assets - credit card/loan liabilities
    const totalAssets =
      bankTotal + sipCurrentTotal + investmentTotal + fdCurrentTotal + offlineTotal;
    const netWorth = totalAssets - totalLiabilities;

    return NextResponse.json({
      netWorth,
      totalAssets,
      totalLiabilities,
      breakdown: {
        bankAccounts: bankTotal,
        sipCurrent: sipCurrentTotal,
        investments: investmentTotal,
        investmentCost,
        investmentGain: investmentTotal - investmentCost,
        fixedDepositsCurrent: fdCurrentTotal,
        offlineAssets: offlineTotal,
        creditCardDue,
        loanLiabilities: liabilityLoans,
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
