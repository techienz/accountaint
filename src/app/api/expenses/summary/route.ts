import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getExpenseSummary } from "@/lib/expenses";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.activeBusiness) return NextResponse.json({ error: "No active business" }, { status: 400 });

  const url = new URL(request.url);
  const dateFrom = url.searchParams.get("dateFrom") || undefined;
  const dateTo = url.searchParams.get("dateTo") || undefined;

  const summary = getExpenseSummary(session.activeBusiness.id, dateFrom, dateTo);
  return NextResponse.json(summary);
}
