import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { backfillJournals } from "@/lib/ledger/backfill";

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.activeBusiness) {
    return NextResponse.json({ error: "No active business" }, { status: 400 });
  }

  const result = backfillJournals(session.activeBusiness.id);
  return NextResponse.json(result);
}
