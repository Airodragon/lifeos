import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getGmailAuthUrl, getGoogleRedirectUri } from "@/lib/email-parser";

export async function GET() {
  try {
    const user = await requireUser();
    const authUrl = getGmailAuthUrl(user.id);
    return NextResponse.json({ authUrl, redirectUri: getGoogleRedirectUri() });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
