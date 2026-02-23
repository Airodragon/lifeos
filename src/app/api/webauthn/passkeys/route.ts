import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();
    const authenticators = await prisma.authenticator.findMany({
      where: { userId: user.id },
      select: { id: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ passkeys: authenticators });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireUser();
    const { id } = await req.json();

    const authenticator = await prisma.authenticator.findFirst({
      where: { id, userId: user.id },
    });
    if (!authenticator) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.authenticator.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
