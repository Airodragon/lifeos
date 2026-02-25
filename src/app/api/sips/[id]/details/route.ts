import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

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
        installments: {
          orderBy: { dueDate: "desc" },
        },
        changeLogs: {
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!sip) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(sip);
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
