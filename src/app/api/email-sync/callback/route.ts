import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";
import { getTokensFromCode } from "@/lib/email-parser";
import { google } from "googleapis";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code || !state) {
      return NextResponse.redirect(new URL("/settings/email?error=missing_params", req.url));
    }

    const tokens = await getTokensFromCode(code);

    let emailAddress = "connected@gmail.com";
    try {
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: tokens.access_token });
      const gmail = google.gmail({ version: "v1", auth: oauth2Client });
      const profile = await gmail.users.getProfile({ userId: "me" });
      emailAddress = profile.data.emailAddress || emailAddress;
    } catch {
      // fallback to generic email
    }

    const existing = await prisma.emailConnection.findFirst({
      where: { userId: state, provider: "gmail" },
    });

    if (existing) {
      await prisma.emailConnection.update({
        where: { id: existing.id },
        data: {
          accessToken: encrypt(tokens.access_token!),
          refreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : existing.refreshToken,
          email: emailAddress,
        },
      });
    } else {
      await prisma.emailConnection.create({
        data: {
          userId: state,
          provider: "gmail",
          accessToken: encrypt(tokens.access_token!),
          refreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
          email: emailAddress,
        },
      });
    }

    const baseUrl = process.env.NEXTAUTH_URL
      || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null)
      || new URL(req.url).origin;

    return NextResponse.redirect(new URL("/settings/email?success=true", baseUrl));
  } catch (error) {
    console.error("Email sync callback error:", error);
    const baseUrl = process.env.NEXTAUTH_URL
      || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null)
      || new URL(req.url).origin;
    return NextResponse.redirect(new URL("/settings/email?error=auth_failed", baseUrl));
  }
}
