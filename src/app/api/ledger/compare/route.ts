import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { compareWithXero } from "@/lib/ledger/compare";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.activeBusiness) {
    return NextResponse.json({ error: "No active business" }, { status: 400 });
  }

  const searchParams = request.nextUrl.searchParams;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to) {
    return NextResponse.json(
      { error: "Missing required query params: from, to" },
      { status: 400 }
    );
  }

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json(
      { error: "Dates must be in YYYY-MM-DD format" },
      { status: 400 }
    );
  }

  const result = compareWithXero(session.activeBusiness.id, from, to);
  return NextResponse.json(result);
}
