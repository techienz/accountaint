import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getInvoiceSummary } from "@/lib/invoices";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.activeBusiness) return NextResponse.json({ error: "No active business" }, { status: 400 });

  const summary = getInvoiceSummary(session.activeBusiness.id);
  return NextResponse.json(summary);
}
