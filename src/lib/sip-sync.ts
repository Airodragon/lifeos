import { prisma } from "@/lib/prisma";
import { getQuotes } from "@/lib/yahoo-finance";
import { getLatestMfNav } from "@/lib/mf-nav";

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
    },
    include: {
      installments: {
        orderBy: { dueDate: "asc" },
      },
    },
  });

  const symbols = [
    ...new Set(
      sips
        .filter((s) => s.pricingSource !== "mf_nav")
        .map((s) => s.symbol)
        .filter(Boolean) as string[]
    ),
  ];
  const quotes = symbols.length ? await getQuotes(symbols) : new Map();

  let priceUpdated = 0;
  let installmentsPosted = 0;
  let skipped = 0;
  const reasons: Record<string, number> = {
    missingMapping: 0,
    sourceUnavailable: 0,
    invalidPrice: 0,
  };

  for (const sip of sips) {
    let currentPrice = 0;
    let sourceLabel = "market";
    if (sip.pricingSource === "mf_nav") {
      if (!sip.schemeCode) {
        skipped++;
        reasons.missingMapping++;
        continue;
      }
      const nav = await getLatestMfNav(sip.schemeCode);
      if (!nav) {
        skipped++;
        reasons.sourceUnavailable++;
        continue;
      }
      currentPrice = nav.nav;
      sourceLabel = "mf_nav";
    } else {
      if (!sip.symbol) {
        skipped++;
        reasons.missingMapping++;
        continue;
      }
      const quote = quotes.get(sip.symbol);
      if (!quote) {
        skipped++;
        reasons.sourceUnavailable++;
        continue;
      }
      currentPrice = quote.price;
    }
    if (!currentPrice || currentPrice <= 0) {
      skipped++;
      reasons.invalidPrice++;
      continue;
    }

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
    const addUnits = due ? installmentAmount / currentPrice : 0;

    let paidInvested = 0;
    let paidUnits = 0;
    for (const row of sip.installments) {
      if (row.status !== "paid") continue;
      paidInvested += Number(row.amount);
      paidUnits += Number(row.units || 0);
    }

    const nextInvested = paidInvested + (due ? installmentAmount : 0);
    const nextUnits = paidUnits + (due ? addUnits : 0);
    const nextCurrentValue = nextUnits > 0 ? nextUnits * currentPrice : Number(sip.currentValue || 0);

    await prisma.sIP.update({
      where: { id: sip.id },
      data: {
        units: nextUnits,
        totalInvested: nextInvested,
        currentValue: nextCurrentValue,
        lastPrice: currentPrice,
        lastUpdated: now,
        ...(due ? { lastDebitDate: now } : {}),
        ...(sip.pricingSource === "mf_nav" ? { schemeName: sip.schemeName || sip.fundName } : {}),
        changeLogs: {
          create: {
            userId,
            action: "valuation_sync",
            field: sourceLabel,
            fromValue: String(sip.lastPrice || ""),
            toValue: String(currentPrice),
          },
        },
        ...(due
          ? {
              installments: {
                create: {
                  userId,
                  dueDate: now,
                  status: "paid",
                  amount: installmentAmount,
                  navOrPrice: currentPrice,
                  units: addUnits,
                  isManual: false,
                  note: "Auto-posted by SIP sync",
                },
              },
            }
          : {}),
      },
    });

    priceUpdated++;
    if (due) installmentsPosted++;
  }

  return { priceUpdated, installmentsPosted, skipped, reasons, total: sips.length };
}

