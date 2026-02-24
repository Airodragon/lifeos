import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncEmailConnection } from "@/lib/email-sync";

export async function POST() {
  try {
    const user = await requireUser();
    const connection = await prisma.emailConnection.findFirst({
      where: { userId: user.id, provider: "gmail" },
      orderBy: { createdAt: "desc" },
    });
    if (!connection) {
      return NextResponse.json(
        { error: "No Gmail connection found" },
        { status: 400 }
      );
    }

    const result = await syncEmailConnection(connection.id);
    return NextResponse.json({ synced: result.synced });
  } catch {
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
