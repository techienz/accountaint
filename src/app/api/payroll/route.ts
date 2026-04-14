import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listPayRuns, createPayRun } from "@/lib/payroll";

export async function GET() {
  const session = await getSession();
  if (!session?.activeBusiness) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const runs = listPayRuns(session.activeBusiness.id);
  return NextResponse.json(runs);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.activeBusiness) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json();
  const { period_start, period_end, pay_date, frequency, employee_ids, notes } = body;

  if (!period_start || !period_end || !pay_date || !frequency || !employee_ids?.length) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const payRun = createPayRun(session.activeBusiness.id, {
    period_start, period_end, pay_date, frequency, employee_ids, notes,
  });

  return NextResponse.json(payRun, { status: 201 });
}
