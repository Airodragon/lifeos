import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { searchMfSchemes } from "@/lib/mf-nav";

export async function GET(req: Request) {
  try {
    await requireUser();
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    if (q.length < 2) return NextResponse.json([]);
    const results = await searchMfSchemes(q, 15);
    return NextResponse.json(results);
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
