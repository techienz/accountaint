import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { searchCompanies, isNzbnConfigured } from "@/lib/nzbn/client";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isNzbnConfigured()) {
    return NextResponse.json({ error: "NZBN API key not configured" }, { status: 503 });
  }

  const query = request.nextUrl.searchParams.get("q") || "";
  if (query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const results = await searchCompanies(query);
  return NextResponse.json({ results });
}
