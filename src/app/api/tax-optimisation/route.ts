import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { runTaxOptimisationAnalysis, getLatestOptimisationResults } from "@/lib/tax/optimisation/analyse";

export async function GET() {
  const session = await getSession();
  if (!session?.activeBusiness) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = getLatestOptimisationResults(session.activeBusiness.id);
  return NextResponse.json({ result });
}

export async function POST() {
  const session = await getSession();
  if (!session?.activeBusiness) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fire-and-forget — analysis can take 30-60s with web search
  runTaxOptimisationAnalysis(session.activeBusiness.id).catch((err) => {
    console.error("[tax-optimisation] Analysis failed:", err);
  });

  return NextResponse.json({ started: true });
}
