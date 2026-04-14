import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { applyRecommendation } from "@/lib/tax/optimisation/actions";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.activeBusiness) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { resultId, recommendationId } = await request.json();
  if (!resultId || !recommendationId) {
    return NextResponse.json({ error: "resultId and recommendationId required" }, { status: 400 });
  }

  const result = applyRecommendation(
    session.activeBusiness.id,
    resultId,
    recommendationId
  );

  if (!result.success) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, message: result.message });
}
