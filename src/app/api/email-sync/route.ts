import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getGmailAuthUrl } from "@/lib/email-parser";

export async function GET() {
  try {
    const user = await requireUser();
    const authUrl = getGmailAuthUrl(user.id);
    return NextResponse.json({ authUrl });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
