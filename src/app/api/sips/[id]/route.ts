import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

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
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const sip = await prisma.sIP.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.fundName && { fundName: body.fundName }),
        ...(body.amount && { amount: body.amount }),
        ...(body.totalInvested !== undefined && { totalInvested: body.totalInvested }),
        ...(body.currentValue !== undefined && { currentValue: body.currentValue }),
        ...(body.units !== undefined && { units: body.units }),
        ...(body.status && { status: body.status }),
        ...(body.lastDebitDate && { lastDebitDate: new Date(body.lastDebitDate) }),
        ...(body.expectedReturn !== undefined && { expectedReturn: body.expectedReturn }),
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

    await prisma.sIP.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
