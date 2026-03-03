import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

const COMPOUNDING_N: Record<string, number> = {
  monthly: 12,
  quarterly: 4,
  half_yearly: 2,
  yearly: 1,
};

function getFDCurrentValue(principal: number, ratePercent: number, compounding: string, startDate: Date) {
  const years = Math.max(0, (Date.now() - startDate.getTime()) / (365.25 * 86400000));
  const n = COMPOUNDING_N[compounding] || 4;
  const r = ratePercent / 100;
  return principal * Math.pow(1 + r / n, n * years);
}

function compoundGrow(value: number, annualRate: number, months: number) {
  return value * Math.pow(1 + annualRate / 12, months);
}

export async function GET() {
  try {
    const user = await requireUser();

    const [accounts, investments, sips, fixedDeposits, offlineAssets, liabilities] = await Promise.all([
      prisma.account.findMany({ where: { userId: user.id } }),
      prisma.investment.findMany({ where: { userId: user.id, deletedAt: null } }),
      prisma.sIP.findMany({ where: { userId: user.id, status: "active" } }),
      prisma.fixedDeposit.findMany({ where: { userId: user.id, status: "active" } }),
      prisma.offlineAsset.findMany({ where: { userId: user.id } }),
      prisma.liability.findMany({ where: { userId: user.id } }),
    ]);

    // Current values
    const bankCash = accounts
      .filter((a) => a.type !== "credit_card")
      .reduce((s, a) => s + Number(a.balance), 0);

    const investmentValue = investments.reduce(
      (s, i) => s + Number(i.currentPrice || i.avgBuyPrice) * Number(i.quantity),
      0
    );

    const sipValue = sips.reduce((s, s2) => s + Number(s2.currentValue || 0), 0);
    const sipMonthly = sips.reduce((s, s2) => s + Number(s2.amount || 0), 0);

    const fdValue = fixedDeposits.reduce((s, fd) => {
      return s + getFDCurrentValue(Number(fd.principal), Number(fd.interestRate), fd.compounding, fd.startDate);
    }, 0);
    const fdRate = fixedDeposits.length > 0
      ? fixedDeposits.reduce((s, fd) => s + Number(fd.interestRate), 0) / fixedDeposits.length
      : 7;

    const offlineValue = offlineAssets.reduce((s, a) => s + Number(a.currentValue), 0);

    const liabilityTotal = liabilities.reduce((s, l) => s + Number(l.outstanding), 0);
    const creditCardDue = accounts
      .filter((a) => a.type === "credit_card")
      .reduce((s, a) => s + Math.max(0, -Number(a.balance)), 0);
    const emiMonthly = liabilities.reduce((s, l) => s + Number(l.emiAmount || 0), 0);

    // Growth assumptions
    const INVESTMENT_CAGR = 0.12; // 12% for stocks/ETF
    const SIP_CAGR = 0.12;        // 12% for mutual funds
    const REALESTATE_CAGR = 0.06; // 6% for real estate
    const GOLD_CAGR = 0.08;       // 8% for gold
    const BANK_RATE = 0.04;       // 4% savings account interest

    // Offline assets split: treat all as "real estate" rate for simplicity
    // unless asset type is gold — look for gold-type assets
    const goldAssets = offlineAssets.filter((a) => a.type?.toLowerCase().includes("gold"));
    const nonGoldOffline = offlineAssets.filter((a) => !a.type?.toLowerCase().includes("gold"));
    const goldValue = goldAssets.reduce((s, a) => s + Number(a.currentValue), 0);
    const realEstateValue = nonGoldOffline.reduce((s, a) => s + Number(a.currentValue), 0);

    // Generate monthly projection for 60 months (5 years)
    const totalMonths = 60;
    const milestoneMonths = [0, 12, 36, 60];
    const monthlyData: Array<{ month: number; label: string; netWorth: number }> = [];

    for (let m = 0; m <= totalMonths; m++) {
      if (!milestoneMonths.includes(m) && m % 6 !== 0) continue;

      const projBank = compoundGrow(bankCash, BANK_RATE, m);
      const projInvestment = compoundGrow(investmentValue, INVESTMENT_CAGR, m);
      // SIP: compound existing value + future contributions
      const projSip = compoundGrow(sipValue, SIP_CAGR, m) +
        (sipMonthly > 0
          ? sipMonthly * ((Math.pow(1 + SIP_CAGR / 12, m) - 1) / (SIP_CAGR / 12))
          : 0);
      const projFd = compoundGrow(fdValue, fdRate / 100, m);
      const projGold = compoundGrow(goldValue, GOLD_CAGR, m);
      const projRealEstate = compoundGrow(realEstateValue, REALESTATE_CAGR, m);

      // Liabilities decrease as EMI is paid
      const projLiabilities = Math.max(0, liabilityTotal - emiMonthly * m) + creditCardDue;

      const totalAssets = projBank + projInvestment + projSip + projFd + projGold + projRealEstate;
      const netWorth = totalAssets - projLiabilities;

      const label = m === 0 ? "Now" : m === 12 ? "1Y" : m === 24 ? "2Y" : m === 36 ? "3Y" : m === 48 ? "4Y" : `${m}M`;
      monthlyData.push({ month: m, label, netWorth: Math.round(netWorth) });
    }

    // Milestone summary
    const nowNW = monthlyData.find((d) => d.month === 0)?.netWorth || 0;
    const oneYearNW = monthlyData.find((d) => d.month === 12)?.netWorth || 0;
    const threeYearNW = monthlyData.find((d) => d.month === 36)?.netWorth || 0;
    const fiveYearNW = monthlyData.find((d) => d.month === 60)?.netWorth || 0;

    return NextResponse.json({
      projection: monthlyData,
      milestones: {
        now: nowNW,
        oneYear: oneYearNW,
        threeYear: threeYearNW,
        fiveYear: fiveYearNW,
      },
      assumptions: {
        investmentCAGR: INVESTMENT_CAGR * 100,
        sipCAGR: SIP_CAGR * 100,
        realEstateCAGR: REALESTATE_CAGR * 100,
        goldCAGR: GOLD_CAGR * 100,
        bankRate: BANK_RATE * 100,
        sipMonthlyContribution: sipMonthly,
      },
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
