import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listRecurringItems, createRecurringItem } from "@/lib/budget";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json(listRecurringItems(session.user.id));
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, monthly_amount } = body;
  if (!name || monthly_amount == null) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (typeof monthly_amount !== "number" || monthly_amount < 0) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }
  if (body.due_day != null && (body.due_day < 1 || body.due_day > 28)) {
    return NextResponse.json({ error: "Due day must be 1-28" }, { status: 400 });
  }

  const item = createRecurringItem(session.user.id, {
    category_id: body.category_id ?? null,
    name,
    notes: body.notes ?? null,
    monthly_amount,
    due_day: body.due_day ?? null,
    frequency: body.frequency ?? "monthly",
    is_debt: body.is_debt ?? false,
    debt_principal_portion: body.debt_principal_portion ?? null,
    is_active: body.is_active,
  });
  return NextResponse.json(item, { status: 201 });
}
