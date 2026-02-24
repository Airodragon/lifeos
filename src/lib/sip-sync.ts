import { prisma } from "@/lib/prisma";
import { getQuotes } from "@/lib/yahoo-finance";

function daysInMonth(year: number, monthZeroBased: number) {
  return new Date(year, monthZeroBased + 1, 0).getDate();
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function monthDiff(a: Date, b: Date) {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

function isSipDue(
  frequency: string,
  sipDate: number,
  startDate: Date,
  lastDebitDate: Date | null,
  now: Date
) {
  const nowDay = startOfDay(now);
  if (nowDay < startOfDay(startDate)) return false;

  if (frequency === "weekly") {
    if (!lastDebitDate) return true;
    const diffDays = Math.floor(
      (nowDay.getTime() - startOfDay(lastDebitDate).getTime()) / 86400000
    );
    return diffDays >= 7;
  }

  const dueDay = Math.min(sipDate, daysInMonth(now.getFullYear(), now.getMonth()));
  const dueDateThisMonth = new Date(now.getFullYear(), now.getMonth(), dueDay);
  if (nowDay < dueDateThisMonth) return false;

  if (frequency === "quarterly") {
    const diff = monthDiff(startDate, now);
    if (diff < 0 || diff % 3 !== 0) return false;
  }

  if (!lastDebitDate) return true;
  return !isSameMonth(lastDebitDate, now);
}

export async function syncSipsForUser(userId: string) {
  const now = new Date();
  const sips = await prisma.sIP.findMany({
    where: {
      userId,
      symbol: { not: null },
    },
  });

  const symbols = [...new Set(sips.map((s) => s.symbol).filter(Boolean) as string[])];
  const quotes = symbols.length ? await getQuotes(symbols) : new Map();

  let priceUpdated = 0;
  let installmentsPosted = 0;

  for (const sip of sips) {
    if (!sip.symbol) continue;
    const quote = quotes.get(sip.symbol);
    if (!quote || !quote.price || quote.price <= 0) continue;

    const due =
      sip.status === "active" &&
      (!sip.endDate || startOfDay(now) <= startOfDay(sip.endDate)) &&
      isSipDue(
        sip.frequency,
        sip.sipDate,
        sip.startDate,
        sip.lastDebitDate,
        now
      );
    const installmentAmount = Number(sip.amount);
    const addUnits = due ? installmentAmount / quote.price : 0;

    await prisma.sIP.update({
      where: { id: sip.id },
      data: {
        units: Number(sip.units) + addUnits,
        totalInvested: Number(sip.totalInvested) + (due ? installmentAmount : 0),
        currentValue: (Number(sip.units) + addUnits) * quote.price,
        lastPrice: quote.price,
        lastUpdated: now,
        ...(due ? { lastDebitDate: now } : {}),
      },
    });

    priceUpdated++;
    if (due) installmentsPosted++;
  }

  return { priceUpdated, installmentsPosted, total: sips.length };
}

