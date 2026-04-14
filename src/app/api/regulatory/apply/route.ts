import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { applyRegulatoryChange } from "@/lib/regulatory/apply";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { checkId } = await request.json();
  if (!checkId) {
    return NextResponse.json({ error: "checkId required" }, { status: 400 });
  }

  const result = applyRegulatoryChange(checkId);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
