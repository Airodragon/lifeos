/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { prisma } from "@/lib/prisma";
import { passkeyChallenge } from "@/lib/passkey-store";

const rpID = process.env.WEBAUTHN_RP_ID || "localhost";

export async function GET() {
  try {
    const authenticators = await prisma.authenticator.findMany({
      select: { credentialId: true, transports: true },
    });

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: authenticators.map((auth) => ({
        id: auth.credentialId,
        transports: auth.transports,
      })) as any,
      userVerification: "preferred",
    });

    passkeyChallenge.set("login", options.challenge);

    return NextResponse.json(options);
  } catch (error) {
    console.error("Passkey begin error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
