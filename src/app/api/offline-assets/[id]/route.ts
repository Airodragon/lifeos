import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const asset = await prisma.offlineAsset.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });
    if (!asset) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await prisma.offlineAsset.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
