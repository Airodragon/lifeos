import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";
import { getTokensFromCode } from "@/lib/email-parser";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code || !state) {
      return NextResponse.redirect(new URL("/settings/email?error=missing_params", req.url));
    }

    const tokens = await getTokensFromCode(code);

    await prisma.emailConnection.create({
      data: {
        userId: state,
        provider: "gmail",
        accessToken: encrypt(tokens.access_token!),
        refreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
        email: "connected@gmail.com",
      },
    });

    return NextResponse.redirect(new URL("/settings/email?success=true", req.url));
  } catch {
    return NextResponse.redirect(new URL("/settings/email?error=auth_failed", req.url));
  }
}
