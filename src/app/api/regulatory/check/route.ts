import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { runRegulatoryCheck, getLatestCheckRun, getCheckResults } from "@/lib/regulatory/verify";
import { REGULATORY_AREAS } from "@/lib/regulatory/registry";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const latestRun = getLatestCheckRun();
  if (!latestRun) {
    return NextResponse.json({ run: null, results: [], areas: REGULATORY_AREAS.map((a) => ({ id: a.id, label: a.label })) });
  }

  const results = getCheckResults(latestRun.id);
  return NextResponse.json({
    run: latestRun,
    results,
    areas: REGULATORY_AREAS.map((a) => ({ id: a.id, label: a.label })),
  });
}

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fire-and-forget: start the check in the background
  // The UI polls GET to see results
  runRegulatoryCheck().catch((err) => {
    console.error("[regulatory] Check failed:", err);
  });

  return NextResponse.json({ started: true });
}
