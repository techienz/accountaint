import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getOrCreateBudgetConfig, updateBudgetConfig } from "@/lib/budget";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = getOrCreateBudgetConfig(session.user.id);
  return NextResponse.json(config);
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  if (body.pay_frequency) {
    const valid = ["weekly", "fortnightly", "monthly"];
    if (!valid.includes(body.pay_frequency)) {
      return NextResponse.json({ error: "Invalid pay frequency" }, { status: 400 });
    }
  }

  if (body.pay_anchor_date && !/^\d{4}-\d{2}-\d{2}$/.test(body.pay_anchor_date)) {
    return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
  }

  const config = updateBudgetConfig(session.user.id, body);
  return NextResponse.json(config);
}
