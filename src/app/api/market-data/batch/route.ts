import { NextResponse } from "next/server";
import { getQuotes } from "@/lib/yahoo-finance";
import { requireUser } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    await requireUser();
    const { symbols } = await req.json();
    if (!Array.isArray(symbols) || symbols.length === 0) {
      return NextResponse.json({});
    }

    const unique = [...new Set(symbols as string[])].slice(0, 30);
    const quotes = await getQuotes(unique);

    const result: Record<string, number> = {};
    quotes.forEach((q, symbol) => {
      result[symbol] = q.price;
    });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
