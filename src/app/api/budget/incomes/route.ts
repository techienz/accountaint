import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listIncomes, createIncome } from "@/lib/budget";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json(listIncomes(session.user.id));
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { label, monthly_amount } = body;
  if (!label || monthly_amount == null) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (typeof monthly_amount !== "number" || monthly_amount < 0) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  const income = createIncome(session.user.id, {
    label,
    monthly_amount,
    notes: body.notes ?? null,
    is_active: body.is_active,
  });
  return NextResponse.json(income, { status: 201 });
}
