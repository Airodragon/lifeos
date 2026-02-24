import { prisma } from "@/lib/prisma";

export async function recomputeInvestmentFromLedger(
  userId: string,
  investmentId: string
) {
  const txns = await prisma.investmentTransaction.findMany({
    where: { userId, investmentId },
    orderBy: { date: "asc" },
  });

  let quantity = 0;
  let costBasis = 0;

  for (const t of txns) {
    const qty = Number(t.quantity || 0);
    const amount = Number(t.amount || 0);

    if (t.type === "buy" || t.type === "sip") {
      quantity += qty;
      costBasis += amount + Number(t.fees || 0) + Number(t.taxes || 0);
    } else if (t.type === "sell") {
      if (quantity <= 0) continue;
      const avgCost = quantity > 0 ? costBasis / quantity : 0;
      const reducingQty = Math.min(quantity, qty);
      costBasis -= avgCost * reducingQty;
      quantity -= reducingQty;
      if (quantity < 0.000001) {
        quantity = 0;
        costBasis = 0;
      }
    } else if (t.type === "fee") {
      costBasis += amount;
    }
  }

  const avgBuyPrice = quantity > 0 ? costBasis / quantity : 0;

  return prisma.investment.update({
    where: { id: investmentId },
    data: {
      quantity,
      avgBuyPrice,
    },
  });
}

