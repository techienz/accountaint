import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { disposeAsset } from "@/lib/assets/disposal";

export async function POST(
  request: NextRequest,
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

  const body = await request.json();
  const { sale_price, disposal_date } = body;

  if (sale_price == null || !disposal_date) {
    return NextResponse.json(
      { error: "sale_price and disposal_date are required" },
      { status: 400 }
    );
  }

  try {
    const result = await disposeAsset(id, business.id, sale_price, disposal_date);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Disposal failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
