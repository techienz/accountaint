import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listInvestments, createInvestment } from "@/lib/budget";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json(listInvestments(session.user.id));
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  if (!body.name || !body.type || body.cost_basis == null || body.current_value == null) {
    return NextResponse.json(
      { error: "name, type, cost_basis, and current_value are required" },
      { status: 400 }
    );
  }

  const investment = createInvestment(session.user.id, {
    name: body.name,
    type: body.type,
    platform: body.platform ?? null,
    units: body.units ?? null,
    cost_basis: body.cost_basis,
    current_value: body.current_value,
    currency: body.currency ?? "NZD",
    nzd_rate: body.nzd_rate ?? 1,
    purchase_date: body.purchase_date ?? null,
    notes: body.notes ?? null,
    status: body.status ?? "active",
  });
  return NextResponse.json(investment, { status: 201 });
}
