import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { z } from "zod";
import { getQuote } from "@/lib/yahoo-finance";
import { getLatestMfNav } from "@/lib/mf-nav";

const createSchema = z.object({
  name: z.string().min(1),
  fundName: z.string().min(1),
  symbol: z.string().optional(),
  pricingSource: z.enum(["market", "mf_nav"]).optional(),
  schemeCode: z.string().optional(),
  schemeName: z.string().optional(),
  amount: z.number().positive(),
  frequency: z.enum(["monthly", "weekly", "quarterly"]).optional(),
  sipDate: z.number().min(1).max(31).optional(),
  startDate: z.string(),
  endDate: z.string().optional(),
  totalInvested: z.number().optional(),
  currentValue: z.number().optional(),
  units: z.number().optional(),
  expectedReturn: z.number().optional(),
  installments: z.array(
    z.object({
      dueDate: z.string(),
      status: z.enum(["due", "paid", "skipped", "missed"]),
      amount: z.number().positive(),
      navOrPrice: z.number().positive().optional(),
      units: z.number().nonnegative().optional(),
      note: z.string().optional(),
    })
  ).optional(),
});

export async function GET() {
  try {
    const user = await requireUser();
    const sips = await prisma.sIP.findMany({
      where: { userId: user.id },
      include: {
        installments: {
          orderBy: { dueDate: "desc" },
          take: 20,
        },
        changeLogs: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(sips);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const data = createSchema.parse(body);
    const pricingSource = data.pricingSource || "mf_nav";
    const normalizedSymbol = data.symbol?.trim().toUpperCase() || null;
    const normalizedSchemeCode = String(data.schemeCode || "").trim() || null;
    const normalizedSchemeName = String(data.schemeName || "").trim() || null;

    if (pricingSource === "mf_nav") {
      if (!normalizedSchemeCode) {
        return NextResponse.json({ error: "Mutual fund scheme selection is required." }, { status: 400 });
      }
      const nav = await getLatestMfNav(normalizedSchemeCode);
      if (!nav) {
        return NextResponse.json({ error: "Unable to validate mutual fund scheme NAV. Please re-select scheme." }, { status: 400 });
      }
    } else {
      if (!normalizedSymbol) {
        return NextResponse.json({ error: "Market symbol is required for live tracking." }, { status: 400 });
      }
      const quote = await getQuote(normalizedSymbol);
      if (!quote?.price || quote.price <= 0) {
        return NextResponse.json({ error: "Invalid market symbol. Please choose a valid symbol." }, { status: 400 });
      }
    }

    const manualRows = data.installments || [];
    const paidRows = manualRows.filter((r) => r.status === "paid");
    const investedFromLedger = paidRows.reduce((sum, row) => sum + row.amount, 0);
    const unitsFromLedger = paidRows.reduce((sum, row) => {
      if (typeof row.units === "number") return sum + row.units;
      if (typeof row.navOrPrice === "number" && row.navOrPrice > 0) return sum + row.amount / row.navOrPrice;
      return sum;
    }, 0);
    const manualCurrentValue = paidRows.reduce((sum, row) => {
      if (typeof row.units === "number" && typeof row.navOrPrice === "number") return sum + row.units * row.navOrPrice;
      return sum;
    }, 0);

    const sip = await prisma.sIP.create({
      data: {
        userId: user.id,
        name: data.name,
        fundName: data.fundName,
        symbol: normalizedSymbol,
        pricingSource,
        schemeCode: normalizedSchemeCode,
        schemeName: normalizedSchemeName,
        amount: data.amount,
        frequency: data.frequency || "monthly",
        sipDate: data.sipDate || 1,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        totalInvested: investedFromLedger || data.totalInvested || 0,
        currentValue: manualCurrentValue || data.currentValue || 0,
        units: unitsFromLedger || data.units || 0,
        expectedReturn: data.expectedReturn || 12,
        installments: manualRows.length
          ? {
              create: manualRows.map((row) => ({
                userId: user.id,
                dueDate: new Date(row.dueDate),
                status: row.status,
                amount: row.amount,
                navOrPrice: row.navOrPrice,
                units:
                  typeof row.units === "number"
                    ? row.units
                    : typeof row.navOrPrice === "number" && row.navOrPrice > 0
                      ? row.amount / row.navOrPrice
                      : null,
                isManual: true,
                note: row.note || null,
              })),
            }
          : undefined,
        changeLogs: {
          create: [
            {
              userId: user.id,
              action: "sip_created",
              note: "SIP created with lifecycle tracking",
            },
            ...(manualRows.length
              ? [
                  {
                    userId: user.id,
                    action: "manual_history_added",
                    note: `Added ${manualRows.length} historical installment entries`,
                  },
                ]
              : []),
          ],
        },
      },
    });

    return NextResponse.json(sip, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
