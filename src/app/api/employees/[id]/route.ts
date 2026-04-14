import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getEmployee, updateEmployee } from "@/lib/employees";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.activeBusiness) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const emp = getEmployee(session.activeBusiness.id, id);
  if (!emp) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(emp);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.activeBusiness) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  updateEmployee(session.activeBusiness.id, id, body);
  return NextResponse.json({ success: true });
}
