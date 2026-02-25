import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const sip = await prisma.sIP.findFirst({
      where: { id, userId: user.id },
    });
    if (!sip) {
      return NextResponse.json({ error: "SIP not found" }, { status: 404 });
    }
    if (!sip.symbol) {
      return NextResponse.json(
        { error: "SIP symbol is required before migration" },
        { status: 400 }
      );
    }
    const sipSymbol = sip.symbol;

    const units = Number(sip.units);
    const totalInvested = Number(sip.totalInvested);
    if (!Number.isFinite(units) || units <= 0) {
      return NextResponse.json(
        { error: "SIP must have units before migration" },
        { status: 400 }
      );
    }
    if (!Number.isFinite(totalInvested) || totalInvested <= 0) {
      return NextResponse.json(
        { error: "SIP must have invested amount before migration" },
        { status: 400 }
      );
    }

    const avgBuyPrice = totalInvested / units;
    const currentPrice =
      Number(sip.lastPrice) > 0
        ? Number(sip.lastPrice)
        : Number(sip.currentValue) > 0
          ? Number(sip.currentValue) / units
          : avgBuyPrice;

    const now = new Date();
    const existingMf = await prisma.investment.findFirst({
      where: {
        userId: user.id,
        symbol: sipSymbol,
        type: "mutual_fund",
      },
    });

    let investmentId = "";
    let merged = false;
    await prisma.$transaction(async (tx) => {
      if (existingMf) {
        const oldQty = Number(existingMf.quantity);
        const oldAvg = Number(existingMf.avgBuyPrice);
        const newQty = oldQty + units;
        const newAvg =
          newQty > 0 ? (oldQty * oldAvg + units * avgBuyPrice) / newQty : oldAvg;
        const updated = await tx.investment.update({
          where: { id: existingMf.id },
          data: {
            quantity: newQty,
            avgBuyPrice: newAvg,
            currentPrice,
            lastUpdated: now,
          },
        });
        investmentId = updated.id;
        merged = true;
      } else {
        const created = await tx.investment.create({
          data: {
            userId: user.id,
            symbol: sipSymbol,
            name: sip.fundName || sip.name,
            type: "mutual_fund",
            quantity: units,
            avgBuyPrice,
            currentPrice,
            currency: "INR",
            lastUpdated: now,
          },
        });
        investmentId = created.id;
      }

      await tx.sIP.update({
        where: { id: sip.id },
        data: {
          status: "migrated",
          endDate: sip.endDate || now,
          linkedInvestmentId: investmentId,
          changeLogs: {
            create: {
              userId: user.id,
              action: "sip_migrated",
              field: "linkedInvestmentId",
              fromValue: sip.linkedInvestmentId || "",
              toValue: investmentId,
              note: merged ? "Merged into existing MF holding" : "Created new MF holding via migration",
            },
          },
        },
      });
    });

    return NextResponse.json({
      success: true,
      investmentId,
      merged,
      message: merged
        ? "SIP migrated and merged into existing MF holding"
        : "SIP migrated to MF holding",
    });
  } catch {
    return NextResponse.json({ error: "Migration failed" }, { status: 500 });
  }
}

