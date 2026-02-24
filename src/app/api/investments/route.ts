import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { z } from "zod";
import { getQuotes } from "@/lib/yahoo-finance";

const createSchema = z.object({
  symbol: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["stock", "etf", "crypto", "mutual_fund"]),
  quantity: z.number().positive(),
  avgBuyPrice: z.number().positive(),
  currentPrice: z.number().optional(),
  currency: z.string().default("INR"),
});

export async function GET() {
  try {
    const user = await requireUser();
    const investments = await prisma.investment.findMany({
      where: { userId: user.id, deletedAt: null },
      include: { dividends: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(investments);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const data = createSchema.parse(body);
    const symbol = data.symbol.trim().toUpperCase();

    if (!/^[A-Z0-9.\-]{2,20}$/.test(symbol)) {
      return NextResponse.json(
        { error: "Invalid symbol format. Use a valid market ticker (e.g., RELIANCE.NS)." },
        { status: 400 }
      );
    }

    if (data.type !== "mutual_fund") {
      const quote = await getQuotes([symbol]);
      if (!quote.has(symbol)) {
        return NextResponse.json(
          { error: "Symbol not found in market data. Please verify and try again." },
          { status: 400 }
        );
      }
    }

    const investment = await prisma.investment.create({
      data: {
        userId: user.id,
        ...data,
        symbol,
      },
    });

    return NextResponse.json(investment, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
