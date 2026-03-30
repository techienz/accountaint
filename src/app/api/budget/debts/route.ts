import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listDebts, createDebt } from "@/lib/budget";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json(listDebts(session.user.id));
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, balance, monthly_repayment, interest_rate } = body;
  if (!name || balance == null || monthly_repayment == null || interest_rate == null) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const debt = createDebt(session.user.id, {
    name,
    balance,
    monthly_repayment,
    interest_rate,
    is_mortgage: body.is_mortgage ?? false,
    property_value: body.property_value ?? null,
    notes: body.notes ?? null,
    status: body.status,
  });
  return NextResponse.json(debt, { status: 201 });
}
