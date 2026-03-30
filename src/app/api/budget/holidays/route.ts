import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listHolidays, createHoliday } from "@/lib/budget";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json(listHolidays(session.user.id));
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  if (!body.destination) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const holiday = createHoliday(session.user.id, {
    savings_goal_id: body.savings_goal_id ?? null,
    destination: body.destination,
    date: body.date ?? null,
    year: body.year ?? null,
    accommodation_cost: body.accommodation_cost ?? 0,
    travel_cost: body.travel_cost ?? 0,
    spending_budget: body.spending_budget ?? 0,
    other_costs: body.other_costs ?? 0,
    trip_type: body.trip_type ?? "domestic",
    notes: body.notes ?? null,
  });
  return NextResponse.json(holiday, { status: 201 });
}
