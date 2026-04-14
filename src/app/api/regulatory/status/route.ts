import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getLatestCheckRun, getUnappliedChangesCount } from "@/lib/regulatory/verify";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const latestRun = getLatestCheckRun();
  const unappliedCount = getUnappliedChangesCount();

  return NextResponse.json({
    latestRun,
    unappliedCount,
  });
}
