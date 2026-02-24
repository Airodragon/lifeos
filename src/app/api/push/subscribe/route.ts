import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function GET() {
  return NextResponse.json({
    publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "",
  });
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const endpoint = String(body?.endpoint || "");
    const p256dh = String(body?.keys?.p256dh || "");
    const auth = String(body?.keys?.auth || "");

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: "Invalid subscription payload" }, { status: 400 });
    }

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: {
        userId: user.id,
        p256dh,
        auth,
      },
      create: {
        userId: user.id,
        endpoint,
        p256dh,
        auth,
      },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const endpoint = String(body?.endpoint || "");
    if (!endpoint) return NextResponse.json({ error: "endpoint required" }, { status: 400 });
    await prisma.pushSubscription.deleteMany({ where: { userId: user.id, endpoint } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
