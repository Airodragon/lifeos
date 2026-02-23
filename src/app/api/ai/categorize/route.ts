import { NextResponse } from "next/server";
import { categorizeTransaction } from "@/lib/openai";
import { requireUser } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    await requireUser();
    const body = await req.json();

    const result = await categorizeTransaction(
      body.description,
      body.amount,
      body.merchant
    );

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
