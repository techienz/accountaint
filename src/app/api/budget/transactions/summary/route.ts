import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getTransactionSummary } from "@/lib/budget/transactions";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const summaries = getTransactionSummary(
    session.user.id,
    searchParams.get("start") ?? undefined,
    searchParams.get("end") ?? undefined
  );

  return NextResponse.json(summaries);
}
