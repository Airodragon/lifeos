import { NextResponse } from "next/server";
import { getQuote, searchSymbol } from "@/lib/yahoo-finance";
import { requireUser } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    await requireUser();
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get("symbol");
    const query = searchParams.get("q");

    if (query) {
      const results = await searchSymbol(query);
      return NextResponse.json(results);
    }

    if (symbol) {
      const quote = await getQuote(symbol);
      if (!quote) {
        return NextResponse.json({ error: "Symbol not found" }, { status: 404 });
      }
      return NextResponse.json(quote);
    }

    return NextResponse.json({ error: "Provide symbol or q parameter" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
