import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listSavingsGoals, createSavingsGoal } from "@/lib/budget";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json(listSavingsGoals(session.user.id));
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  if (!body.name) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const goal = createSavingsGoal(session.user.id, {
    name: body.name,
    current_balance: body.current_balance ?? 0,
    target_amount: body.target_amount ?? null,
    fortnightly_contribution: body.fortnightly_contribution ?? 0,
    notes: body.notes ?? null,
    status: body.status,
  });
  return NextResponse.json(goal, { status: 201 });
}
