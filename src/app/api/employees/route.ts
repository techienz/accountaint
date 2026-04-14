import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listEmployees, createEmployee } from "@/lib/employees";
import { accrueAnnualLeave } from "@/lib/employees/leave";

export async function GET() {
  const session = await getSession();
  if (!session?.activeBusiness) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const employees = listEmployees(session.activeBusiness.id);

  // Accrue leave for active employees
  for (const emp of employees) {
    if (emp.is_active) {
      try { accrueAnnualLeave(emp.id); } catch { /* ignore */ }
    }
  }

  // Re-fetch after accrual
  const updated = listEmployees(session.activeBusiness.id);
  return NextResponse.json(updated);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.activeBusiness) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const id = createEmployee(session.activeBusiness.id, body);
  return NextResponse.json({ id }, { status: 201 });
}
