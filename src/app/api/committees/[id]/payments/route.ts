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

    const committee = await prisma.committee.findFirst({
      where: { id, userId: user.id },
    });
    if (!committee) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    if (body.paid !== undefined) {
      updateData.paid = body.paid;
      updateData.paidDate = body.paid ? new Date() : null;
    }

    if (body.amount !== undefined) {
      updateData.amount = body.amount;
    }

    const payment = await prisma.committeePayment.update({
      where: { id: body.paymentId },
      data: updateData,
    });

    return NextResponse.json(payment);
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
