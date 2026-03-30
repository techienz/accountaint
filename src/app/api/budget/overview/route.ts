import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getBudgetOverview } from "@/lib/budget/calculations";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const overview = getBudgetOverview(session.user.id);
  return NextResponse.json(overview);
}
