import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { finalisePayRun } from "@/lib/payroll";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.activeBusiness) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  try {
    const payRun = finalisePayRun(id, session.activeBusiness.id);
    return NextResponse.json(payRun);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to finalise";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
