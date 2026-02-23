import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getQuotes } from "@/lib/yahoo-finance";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const investments = await prisma.investment.findMany({
      select: { id: true, symbol: true },
    });

    const symbols = [...new Set(investments.map((i) => i.symbol))];
    const quotes = await getQuotes(symbols);

    let updated = 0;
    for (const inv of investments) {
      const quote = quotes.get(inv.symbol);
      if (quote) {
        await prisma.investment.update({
          where: { id: inv.id },
          data: {
            currentPrice: quote.price,
            lastUpdated: new Date(),
          },
        });
        updated++;
      }
    }

    return NextResponse.json({ updated, total: investments.length });
  } catch (error) {
    console.error("Price refresh error:", error);
    return NextResponse.json({ error: "Refresh failed" }, { status: 500 });
  }
}
