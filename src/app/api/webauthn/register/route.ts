/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

const rpName = process.env.WEBAUTHN_RP_NAME || "LifeOS";
const rpID = process.env.WEBAUTHN_RP_ID || "localhost";
const origin = process.env.NEXTAUTH_URL || "http://localhost:3000";

const challengeStore = new Map<string, string>();

export async function GET() {
  try {
    const user = await requireUser();

    const existingAuthenticators = await prisma.authenticator.findMany({
      where: { userId: user.id },
    });

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: user.id,
      userName: user.email!,
      attestationType: "none",
      excludeCredentials: existingAuthenticators.map((auth) => ({
        id: auth.credentialId,
        transports: auth.transports,
      })) as any,
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
        authenticatorAttachment: "platform",
      },
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

    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json(
        { error: "Verification failed" },
        { status: 400 }
      );
    }

    const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;

    await prisma.authenticator.create({
      data: {
        userId: user.id,
        credentialId: Buffer.from(credentialID).toString("base64url"),
        credentialPublicKey: Buffer.from(credentialPublicKey),
        counter: BigInt(counter),
        transports: body.response?.transports || [],
      },
    });

    challengeStore.delete(user.id);

    return NextResponse.json({ verified: true });
  } catch {
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
