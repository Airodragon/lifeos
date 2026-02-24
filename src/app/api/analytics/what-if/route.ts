import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";

function futureValue(
  currentCorpus: number,
  monthlyContribution: number,
  annualReturnPercent: number,
  years: number
) {
  const r = annualReturnPercent / 100 / 12;
  const n = Math.max(Math.round(years * 12), 1);
  const fvCorpus = currentCorpus * Math.pow(1 + r, n);
  const fvSip =
    r === 0
      ? monthlyContribution * n
      : monthlyContribution * ((Math.pow(1 + r, n) - 1) / r) * (1 + r);
  return fvCorpus + fvSip;
}

export async function POST(req: Request) {
  try {
    await requireUser();
    const body = await req.json();
    const currentCorpus = Number(body.currentCorpus || 0);
    const monthlyContribution = Number(body.monthlyContribution || 0);
    const monthlyContributionAlt = Number(body.monthlyContributionAlt || monthlyContribution);
    const annualReturn = Number(body.annualReturn || 12);
    const years = Number(body.years || 10);
    const goalAmount = Number(body.goalAmount || 0);

    const baseProjection = futureValue(
      currentCorpus,
      monthlyContribution,
      annualReturn,
      years
    );
    const improvedProjection = futureValue(
      currentCorpus,
      monthlyContributionAlt,
      annualReturn,
      years
    );

    let goalEtaMonths: number | null = null;
    if (goalAmount > 0) {
      const maxMonths = 600;
      for (let m = 1; m <= maxMonths; m++) {
        const value = futureValue(
          currentCorpus,
          monthlyContributionAlt,
          annualReturn,
          m / 12
        );
        if (value >= goalAmount) {
          goalEtaMonths = m;
          break;
        }
      }
    }

    return NextResponse.json({
      baseProjection,
      improvedProjection,
      delta: improvedProjection - baseProjection,
      goalEtaMonths,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

