import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getQuotes } from "@/lib/yahoo-finance";

export async function POST() {
  try {
    const user = await requireUser();
    const sips = await prisma.sIP.findMany({
      where: {
        userId: user.id,
        status: "active",
        symbol: { not: null },
      },
      select: {
        id: true,
        symbol: true,
        units: true,
      },
    });

    const symbols = [...new Set(sips.map((s) => s.symbol).filter(Boolean) as string[])];
    if (!symbols.length) {
      return NextResponse.json({ updated: 0, message: "No SIP symbols found" });
    }

    const quotes = await getQuotes(symbols);
    let updated = 0;
    for (const sip of sips) {
      if (!sip.symbol) continue;
      const quote = quotes.get(sip.symbol);
      if (!quote) continue;
      const units = Number(sip.units);
      const currentValue = units > 0 ? units * quote.price : 0;
      await prisma.sIP.update({
        where: { id: sip.id },
        data: {
          currentValue,
          lastPrice: quote.price,
          lastUpdated: new Date(),
        },
      });
      updated++;
    }

    return NextResponse.json({ updated });
  } catch {
    return NextResponse.json({ error: "Refresh failed" }, { status: 500 });
  }
}
