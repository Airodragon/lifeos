/* eslint-disable @typescript-eslint/no-explicit-any */
import yahooFinance from "yahoo-finance2";

export interface QuoteResult {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  currency: string;
  name: string;
}

export async function getQuote(symbol: string): Promise<QuoteResult | null> {
  try {
    const result: any = await yahooFinance.quote(symbol);
    return {
      symbol: result.symbol,
      price: result.regularMarketPrice ?? 0,
      change: result.regularMarketChange ?? 0,
      changePercent: result.regularMarketChangePercent ?? 0,
      currency: result.currency ?? "INR",
      name: result.shortName ?? result.longName ?? symbol,
    };
  } catch {
    return null;
  }
}

export async function getQuotes(
  symbols: string[]
): Promise<Map<string, QuoteResult>> {
  const results = new Map<string, QuoteResult>();
  const batchSize = 10;

  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    const promises = batch.map((s) => getQuote(s));
    const batchResults = await Promise.allSettled(promises);

    batchResults.forEach((result, index) => {
      if (result.status === "fulfilled" && result.value) {
        results.set(batch[index], result.value);
      }
    });
  }

  return results;
}

export async function searchSymbol(
  query: string
): Promise<{ symbol: string; name: string; type: string }[]> {
  try {
    const result: any = await yahooFinance.search(query);
    return (result.quotes || [])
      .filter((q: any) => q.symbol)
      .slice(0, 10)
      .map((q: any) => ({
        symbol: q.symbol,
        name: q.shortname ?? q.symbol,
        type: q.typeDisp ?? "Equity",
      }));
  } catch {
    return [];
  }
}
