/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

const rpID = process.env.WEBAUTHN_RP_ID || "localhost";
const origin = process.env.NEXTAUTH_URL || "http://localhost:3000";

const challengeStore = new Map<string, string>();

export async function GET() {
  try {
    const user = await requireUser();

    const authenticators = await prisma.authenticator.findMany({
      where: { userId: user.id },
    });

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: authenticators.map((auth) => ({
        id: auth.credentialId,
        transports: auth.transports,
      })) as any,
      userVerification: "preferred",
    });

    challengeStore.set(user.id, options.challenge);

    return NextResponse.json(options);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body: any = await req.json();

    const expectedChallenge = challengeStore.get(user.id);
    if (!expectedChallenge) {
      return NextResponse.json(
        { error: "Challenge not found" },
        { status: 400 }
      );
    }

    const authenticator = await prisma.authenticator.findUnique({
      where: { credentialId: body.id },
    });

    if (!authenticator) {
      return NextResponse.json(
        { error: "Authenticator not found" },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: "Authentication failed" },
        { status: 400 }
      );
    }

    await prisma.authenticator.update({
      where: { id: authenticator.id },
      data: { counter: BigInt(verification.authenticationInfo.newCounter) },
    });

    challengeStore.delete(user.id);

    return NextResponse.json({ verified: true });
  } catch {
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
}
