import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { importOpeningBalances } from "@/lib/ledger/migration";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.activeBusiness) {
    return NextResponse.json({ error: "No active business" }, { status: 400 });
  }

  let body: { asAtDate?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { asAtDate } = body;
  if (!asAtDate || !/^\d{4}-\d{2}-\d{2}$/.test(asAtDate)) {
    return NextResponse.json(
      { error: "asAtDate is required and must be in YYYY-MM-DD format" },
      { status: 400 }
    );
  }

  const result = importOpeningBalances(session.activeBusiness.id, asAtDate);
  return NextResponse.json(result);
}
