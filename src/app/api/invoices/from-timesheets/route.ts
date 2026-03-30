import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createInvoiceFromTimesheets } from "@/lib/invoices/from-timesheets";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.activeBusiness) return NextResponse.json({ error: "No active business" }, { status: 400 });

  const body = await request.json();

  if (!body.requests || !Array.isArray(body.requests) || body.requests.length === 0) {
    return NextResponse.json(
      { error: "requests array is required with at least one item" },
      { status: 400 }
    );
  }

  for (const req of body.requests) {
    if (!req.work_contract_id) {
      return NextResponse.json({ error: "work_contract_id is required for each request" }, { status: 400 });
    }
  }

  try {
    const invoice = await createInvoiceFromTimesheets(
      session.activeBusiness.id,
      body.requests
    );
    return NextResponse.json(invoice, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create invoice";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
