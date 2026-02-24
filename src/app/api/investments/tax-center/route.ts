import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

function round(n: number) {
  return Math.round(n * 100) / 100;
}

type Lot = {
  qty: number;
  price: number;
  date: Date;
};

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const fyStartYear = Number(searchParams.get("fyStartYear")) || new Date().getFullYear();
    const fyStart = new Date(fyStartYear, 3, 1);
    const fyEnd = new Date(fyStartYear + 1, 2, 31, 23, 59, 59, 999);

    const [txns, investments] = await Promise.all([
      prisma.investmentTransaction.findMany({
        where: {
          userId: user.id,
          date: { lte: fyEnd },
          type: { in: ["buy", "sip", "sell"] },
        },
        orderBy: { date: "asc" },
      }),
      prisma.investment.findMany({
        where: { userId: user.id },
        select: { id: true, symbol: true, name: true },
      }),
    ]);

    const investmentName = new Map(investments.map((i) => [i.id, i.symbol || i.name]));
    const lotsByInvestment = new Map<string, Lot[]>();
    const rows: Array<{
      investmentId: string;
      symbol: string;
      date: string;
      quantity: number;
      saleAmount: number;
      cost: number;
      gain: number;
      holdingDays: number;
      taxBucket: "STCG" | "LTCG";
    }> = [];

    for (const txn of txns) {
      if (!lotsByInvestment.has(txn.investmentId)) lotsByInvestment.set(txn.investmentId, []);
      const lots = lotsByInvestment.get(txn.investmentId)!;

      if (txn.type === "buy" || txn.type === "sip") {
        const qty = Number(txn.quantity || 0);
        const price = qty > 0 ? Number(txn.amount) / qty : Number(txn.price || 0);
        if (qty > 0 && price > 0) lots.push({ qty, price, date: new Date(txn.date) });
      }

      if (txn.type === "sell") {
        const saleDate = new Date(txn.date);
        if (saleDate < fyStart || saleDate > fyEnd) continue;

        let sellQty = Number(txn.quantity || 0);
        if (sellQty <= 0 && Number(txn.price || 0) > 0) {
          sellQty = Number(txn.amount) / Number(txn.price || 1);
        }
        if (sellQty <= 0) continue;

        let remaining = sellQty;
        const salePricePerUnit = Number(txn.amount) / sellQty;

        while (remaining > 0.0000001 && lots.length > 0) {
          const lot = lots[0];
          const take = Math.min(remaining, lot.qty);
          const cost = take * lot.price;
          const saleAmount = take * salePricePerUnit;
          const gain = saleAmount - cost;
          const holdingDays = Math.max(
            0,
            Math.floor((saleDate.getTime() - lot.date.getTime()) / 86400000)
          );
          rows.push({
            investmentId: txn.investmentId,
            symbol: investmentName.get(txn.investmentId) || "Holding",
            date: saleDate.toISOString(),
            quantity: round(take),
            saleAmount: round(saleAmount),
            cost: round(cost),
            gain: round(gain),
            holdingDays,
            taxBucket: holdingDays >= 365 ? "LTCG" : "STCG",
          });
          remaining -= take;
          lot.qty -= take;
          if (lot.qty <= 0.0000001) lots.shift();
        }

        if (remaining > 0.0000001) {
          const unresolvedSaleAmount = remaining * salePricePerUnit;
          rows.push({
            investmentId: txn.investmentId,
            symbol: investmentName.get(txn.investmentId) || "Holding",
            date: saleDate.toISOString(),
            quantity: round(remaining),
            saleAmount: round(unresolvedSaleAmount),
            cost: 0,
            gain: round(unresolvedSaleAmount),
            holdingDays: 0,
            taxBucket: "STCG",
          });
        }
      }
    }

    const stcg = rows.filter((r) => r.taxBucket === "STCG");
    const ltcg = rows.filter((r) => r.taxBucket === "LTCG");
    const stcgGain = stcg.reduce((sum, r) => sum + r.gain, 0);
    const ltcgGain = ltcg.reduce((sum, r) => sum + r.gain, 0);
    const stcgTaxEstimate = Math.max(0, stcgGain) * 0.15;
    const taxableLtcg = Math.max(0, ltcgGain - 100000);
    const ltcgTaxEstimate = taxableLtcg * 0.1;

    const monthlyMap = new Map<string, { STCG: number; LTCG: number }>();
    for (const row of rows) {
      const d = new Date(row.date);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, { STCG: 0, LTCG: 0 });
      }
      const slot = monthlyMap.get(monthKey)!;
      slot[row.taxBucket] += row.gain;
    }
    const monthlyRealized = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, gains]) => ({
        month,
        STCG: round(gains.STCG),
        LTCG: round(gains.LTCG),
        Net: round(gains.STCG + gains.LTCG),
      }));

    return NextResponse.json({
      fy: `${fyStartYear}-${fyStartYear + 1}`,
      totals: {
        realizedGain: round(stcgGain + ltcgGain),
        stcgGain: round(stcgGain),
        ltcgGain: round(ltcgGain),
        stcgTaxEstimate: round(stcgTaxEstimate),
        ltcgTaxEstimate: round(ltcgTaxEstimate),
        totalEstimatedTax: round(stcgTaxEstimate + ltcgTaxEstimate),
      },
      harvestCandidates: rows
        .filter((r) => r.gain < 0)
        .sort((a, b) => a.gain - b.gain)
        .slice(0, 8),
      transactions: rows.sort((a, b) => b.date.localeCompare(a.date)),
      monthlyRealized,
      taxBreakup: [
        { name: "STCG Tax", value: round(stcgTaxEstimate), color: "#f97316" },
        { name: "LTCG Tax", value: round(ltcgTaxEstimate), color: "#22c55e" },
      ],
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
