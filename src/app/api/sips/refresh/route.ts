import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { syncSipsForUser } from "@/lib/sip-sync";

export async function POST() {
  try {
    const user = await requireUser();
    const result = await syncSipsForUser(user.id);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Refresh failed" }, { status: 500 });
  }
}
