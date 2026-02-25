import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { z } from "zod";

const createSchema = z.object({
  dueDate: z.string(),
  status: z.enum(["due", "paid", "skipped", "missed"]),
  amount: z.number().positive(),
  navOrPrice: z.number().positive().optional(),
  units: z.number().nonnegative().optional(),
  note: z.string().optional(),
});

const updateSchema = z.object({
  installmentId: z.string(),
  status: z.enum(["due", "paid", "skipped", "missed"]).optional(),
  dueDate: z.string().optional(),
  amount: z.number().positive().optional(),
  navOrPrice: z.number().positive().optional(),
  units: z.number().nonnegative().optional(),
  note: z.string().optional(),
});

function recomputeTotals(
  rows: Array<{ status: string; amount: unknown; units: unknown; navOrPrice: unknown }>
) {
  const paidRows = rows.filter((r) => r.status === "paid");
  const totalInvested = paidRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const units = paidRows.reduce((sum, row) => sum + Number(row.units || 0), 0);
  const latestPrice = paidRows.length
    ? Number(paidRows[paidRows.length - 1].navOrPrice || 0)
    : 0;
  const currentValue = units * latestPrice;
  return { totalInvested, units, currentValue };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const sip = await prisma.sIP.findFirst({
      where: { id, userId: user.id },
      include: {
        installments: { orderBy: { dueDate: "desc" } },
      },
    });
    if (!sip) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(sip.installments);
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await req.json();
    const payload = createSchema.parse(body);
    const sip = await prisma.sIP.findFirst({
      where: { id, userId: user.id },
      include: { installments: true },
    });
    if (!sip) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const created = await prisma.sIPInstallment.create({
      data: {
        sipId: sip.id,
        userId: user.id,
        dueDate: new Date(payload.dueDate),
        status: payload.status,
        amount: payload.amount,
        navOrPrice: payload.navOrPrice,
        units:
          typeof payload.units === "number"
            ? payload.units
            : typeof payload.navOrPrice === "number" && payload.navOrPrice > 0
              ? payload.amount / payload.navOrPrice
              : null,
        note: payload.note || null,
        isManual: true,
      },
    });

    const allRows = [...sip.installments, created];
    const totals = recomputeTotals(allRows);
    await prisma.sIP.update({
      where: { id: sip.id },
      data: {
        totalInvested: totals.totalInvested,
        units: totals.units,
        currentValue: totals.currentValue || sip.currentValue,
        lastUpdated: new Date(),
        changeLogs: {
          create: {
            userId: user.id,
            action: "installment_added",
            note: `Added ${payload.status} installment for ${payload.amount}`,
          },
        },
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await req.json();
    const payload = updateSchema.parse(body);

    const sip = await prisma.sIP.findFirst({
      where: { id, userId: user.id },
      include: { installments: true },
    });
    if (!sip) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const installment = sip.installments.find((i) => i.id === payload.installmentId);
    if (!installment) return NextResponse.json({ error: "Installment not found" }, { status: 404 });

    await prisma.sIPInstallment.update({
      where: { id: installment.id },
      data: {
        ...(payload.status && { status: payload.status }),
        ...(payload.dueDate && { dueDate: new Date(payload.dueDate) }),
        ...(payload.amount !== undefined && { amount: payload.amount }),
        ...(payload.navOrPrice !== undefined && { navOrPrice: payload.navOrPrice }),
        ...(payload.units !== undefined && { units: payload.units }),
        ...(payload.note !== undefined && { note: payload.note || null }),
      },
    });

    const rows = await prisma.sIPInstallment.findMany({
      where: { sipId: sip.id },
      orderBy: { dueDate: "asc" },
    });
    const totals = recomputeTotals(rows);
    await prisma.sIP.update({
      where: { id: sip.id },
      data: {
        totalInvested: totals.totalInvested,
        units: totals.units,
        currentValue: totals.currentValue || sip.currentValue,
        lastUpdated: new Date(),
        changeLogs: {
          create: {
            userId: user.id,
            action: "installment_updated",
            note: `Updated installment ${installment.id}`,
          },
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
