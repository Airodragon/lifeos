import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getQuote } from "@/lib/yahoo-finance";
import { getLatestMfNav } from "@/lib/mf-nav";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await req.json();

    const existing = await prisma.sIP.findFirst({
      where: { id, userId: user.id },
      include: {
        installments: true,
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const nextPricingSource =
      body.pricingSource === "market" || body.pricingSource === "mf_nav"
        ? body.pricingSource
        : existing.pricingSource;
    const nextSymbol =
      body.symbol !== undefined
        ? body.symbol
          ? String(body.symbol).trim().toUpperCase()
          : null
        : existing.symbol;
    const nextSchemeCode =
      body.schemeCode !== undefined
        ? body.schemeCode
          ? String(body.schemeCode).trim()
          : null
        : existing.schemeCode;

    if (nextPricingSource === "mf_nav") {
      if (!nextSchemeCode) {
        return NextResponse.json({ error: "Mutual fund scheme is required for NAV tracking." }, { status: 400 });
      }
      const nav = await getLatestMfNav(nextSchemeCode);
      if (!nav) {
        return NextResponse.json({ error: "Could not validate selected mutual fund scheme." }, { status: 400 });
      }
    } else {
      if (!nextSymbol) {
        return NextResponse.json({ error: "Market symbol is required for market tracking." }, { status: 400 });
      }
      const quote = await getQuote(nextSymbol);
      if (!quote?.price || quote.price <= 0) {
        return NextResponse.json({ error: "Invalid market symbol." }, { status: 400 });
      }
    }

    const changeEntries: Array<{
      action: string;
      field?: string;
      fromValue?: string;
      toValue?: string;
      note?: string;
      userId: string;
    }> = [];
    const trackField = (field: string, before: unknown, after: unknown) => {
      const b = before === null || before === undefined ? "" : String(before);
      const a = after === null || after === undefined ? "" : String(after);
      if (b === a) return;
      changeEntries.push({
        userId: user.id,
        action: "sip_updated",
        field,
        fromValue: b,
        toValue: a,
      });
    };
    trackField("name", existing.name, body.name ?? existing.name);
    trackField("fundName", existing.fundName, body.fundName ?? existing.fundName);
    trackField("symbol", existing.symbol, nextSymbol);
    trackField("schemeCode", existing.schemeCode, nextSchemeCode);
    trackField("amount", existing.amount, body.amount ?? existing.amount);
    trackField("status", existing.status, body.status ?? existing.status);

    const sip = await prisma.sIP.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.fundName && { fundName: body.fundName }),
        ...(body.symbol !== undefined && { symbol: nextSymbol }),
        ...(body.pricingSource !== undefined && { pricingSource: nextPricingSource }),
        ...(body.schemeCode !== undefined && { schemeCode: nextSchemeCode }),
        ...(body.schemeName !== undefined && { schemeName: body.schemeName ? String(body.schemeName).trim() : null }),
        ...(body.amount && { amount: body.amount }),
        ...(body.totalInvested !== undefined && { totalInvested: body.totalInvested }),
        ...(body.currentValue !== undefined && { currentValue: body.currentValue }),
        ...(body.lastPrice !== undefined && { lastPrice: body.lastPrice }),
        ...(body.lastUpdated && { lastUpdated: new Date(body.lastUpdated) }),
        ...(body.units !== undefined && { units: body.units }),
        ...(body.status && { status: body.status }),
        ...(body.lastDebitDate && { lastDebitDate: new Date(body.lastDebitDate) }),
        ...(body.expectedReturn !== undefined && { expectedReturn: body.expectedReturn }),
        ...(body.endDate !== undefined && { endDate: body.endDate ? new Date(body.endDate) : null }),
        ...(changeEntries.length
          ? {
              changeLogs: {
                create: changeEntries,
              },
            }
          : {}),
      },
    });

    return NextResponse.json(sip);
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const existing = await prisma.sIP.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.sIP.update({
      where: { id },
      data: {
        status: "closed",
        endDate: existing.endDate || new Date(),
        changeLogs: {
          create: {
            userId: user.id,
            action: "sip_closed",
            note: "SIP moved to closed state",
          },
        },
      },
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
