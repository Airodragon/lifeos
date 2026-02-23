/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { prisma } from "@/lib/prisma";
import { passkeyChallenge } from "@/lib/passkey-store";

const rpID = process.env.WEBAUTHN_RP_ID || "localhost";
const origin = process.env.NEXTAUTH_URL || "http://localhost:3000";

export async function POST(req: Request) {
  try {
    const body: any = await req.json();

    const expectedChallenge = passkeyChallenge.get("login");
    if (!expectedChallenge) {
      return NextResponse.json({ error: "Challenge expired" }, { status: 400 });
    }

    const authenticator = await prisma.authenticator.findUnique({
      where: { credentialId: body.id },
      include: { user: { select: { id: true, email: true, name: true } } },
    });

    if (!authenticator) {
      return NextResponse.json({ error: "Passkey not found" }, { status: 400 });
    }

    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      authenticator: {
        credentialID: new TextEncoder().encode(authenticator.credentialId),
        credentialPublicKey: new Uint8Array(authenticator.credentialPublicKey),
        counter: Number(authenticator.counter),
        transports: authenticator.transports,
      } as any,
    });

    if (!verification.verified) {
      return NextResponse.json({ error: "Verification failed" }, { status: 400 });
    }

    await prisma.authenticator.update({
      where: { id: authenticator.id },
      data: { counter: BigInt(verification.authenticationInfo.newCounter) },
    });

    passkeyChallenge.delete("login");

    return NextResponse.json({
      verified: true,
      email: authenticator.user.email,
      userId: authenticator.user.id,
    });
  } catch (error) {
    console.error("Passkey complete error:", error);
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
  }
}
