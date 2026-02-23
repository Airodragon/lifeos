import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();
    const assets = await prisma.offlineAsset.findMany({
      where: { userId: user.id },
      include: { documents: true, valuationHistory: { orderBy: { date: "desc" }, take: 10 } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(assets);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();

    const asset = await prisma.offlineAsset.create({
      data: {
        userId: user.id,
        name: body.name,
        type: body.type,
        purchasePrice: body.purchasePrice,
        currentValue: body.currentValue || body.purchasePrice,
        appreciationRate: body.appreciationRate,
        purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : null,
        notes: body.notes,
        valuationHistory: {
          create: {
            value: body.currentValue || body.purchasePrice,
            date: new Date(),
          },
        },
      },
    });

    return NextResponse.json(asset, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
