import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDividendDeclaration } from "@/lib/dividends";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const business = session.activeBusiness;
  if (!business) {
    return NextResponse.json({ error: "No active business" }, { status: 400 });
  }

  const declaration = getDividendDeclaration(id, business.id);
  if (!declaration) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(declaration);
}
