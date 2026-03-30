import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listInvoices, createInvoice } from "@/lib/invoices";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.activeBusiness) return NextResponse.json({ error: "No active business" }, { status: 400 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") as "ACCREC" | "ACCPAY" | null;
  const status = searchParams.get("status") as "draft" | "sent" | "paid" | "overdue" | "void" | null;
  const contactId = searchParams.get("contact_id");

  const invoices = listInvoices(session.activeBusiness.id, {
    type: type || undefined,
    status: status || undefined,
    contactId: contactId || undefined,
  });
  return NextResponse.json(invoices);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.activeBusiness) return NextResponse.json({ error: "No active business" }, { status: 400 });

  const body = await request.json();

  if (!body.contact_id || !body.type || !body.date || !body.due_date) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!["ACCREC", "ACCPAY"].includes(body.type)) {
    return NextResponse.json({ error: "Invalid invoice type" }, { status: 400 });
  }

  if (!body.line_items || !Array.isArray(body.line_items) || body.line_items.length === 0) {
    return NextResponse.json({ error: "At least one line item is required" }, { status: 400 });
  }

  const invoice = createInvoice(session.activeBusiness.id, {
    contact_id: body.contact_id,
    type: body.type,
    date: body.date,
    due_date: body.due_date,
    reference: body.reference ?? null,
    currency_code: body.currency_code ?? "NZD",
    gst_inclusive: body.gst_inclusive ?? false,
    notes: body.notes ?? null,
    payment_instructions: body.payment_instructions ?? null,
    line_items: body.line_items,
  });

  return NextResponse.json(invoice, { status: 201 });
}
