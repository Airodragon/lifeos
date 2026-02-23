import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { requireUser } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    await requireUser();
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const blob = await put(`documents/${Date.now()}-${file.name}`, file, {
      access: "public",
    });

    return NextResponse.json({ url: blob.url, name: file.name });
  } catch {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
