import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { suggestCategory } from "@/lib/expenses/categorise";
import { LmStudioUnavailableError } from "@/lib/lmstudio/embeddings";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.activeBusiness) return NextResponse.json({ error: "No active business" }, { status: 400 });

  let body: { vendor: string; description?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.vendor || typeof body.vendor !== "string") {
    return NextResponse.json({ error: "vendor is required" }, { status: 400 });
  }

  try {
    const suggestion = await suggestCategory(
      session.activeBusiness.id,
      body.vendor,
      body.description || ""
    );

    if (!suggestion) {
      return NextResponse.json({ suggestion: null });
    }

    return NextResponse.json({ suggestion });
  } catch (err) {
    if (err instanceof LmStudioUnavailableError) {
      return NextResponse.json({ suggestion: null, reason: "LM Studio unavailable" });
    }
    throw err;
  }
}
