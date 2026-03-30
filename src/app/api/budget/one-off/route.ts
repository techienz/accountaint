import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listOneOffExpenses, createOneOffExpense } from "@/lib/budget";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json(listOneOffExpenses(session.user.id));
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, amount, date } = body;
  if (!name || amount == null || !date) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (typeof amount !== "number" || amount < 0) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
  }

  const expense = createOneOffExpense(session.user.id, {
    category_id: body.category_id ?? null,
    name,
    notes: body.notes ?? null,
    amount,
    date,
    is_paid: body.is_paid ?? false,
  });
  return NextResponse.json(expense, { status: 201 });
}
