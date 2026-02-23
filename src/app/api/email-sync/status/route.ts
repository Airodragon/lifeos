import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();
    const connection = await prisma.emailConnection.findFirst({
      where: { userId: user.id },
      select: { id: true, email: true, provider: true, lastSyncAt: true },
    });
    return NextResponse.json({ connected: !!connection, connection });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE() {
  try {
    const user = await requireUser();
    await prisma.emailConnection.deleteMany({ where: { userId: user.id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
