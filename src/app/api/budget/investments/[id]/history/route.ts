import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listInvestmentValueHistory } from "@/lib/budget";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  return NextResponse.json(listInvestmentValueHistory(id, session.user.id));
}
