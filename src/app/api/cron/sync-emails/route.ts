import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncEmailConnection } from "@/lib/email-sync";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const connections = await prisma.emailConnection.findMany();

    let synced = 0;

    for (const conn of connections) {
      try {
        const result = await syncEmailConnection(conn.id);
        synced += result.synced;
      } catch (error) {
        console.error(`Email sync failed for connection ${conn.id}:`, error);
      }
    }

    return NextResponse.json({ synced });
  } catch (error) {
    console.error("Email sync error:", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
