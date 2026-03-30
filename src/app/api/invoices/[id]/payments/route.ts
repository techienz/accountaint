import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listPayments, recordPayment } from "@/lib/invoices/payments";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.activeBusiness) return NextResponse.json({ error: "No active business" }, { status: 400 });

  const { id } = await params;
  const payments = listPayments(id, session.activeBusiness.id);
  return NextResponse.json(payments);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.activeBusiness) return NextResponse.json({ error: "No active business" }, { status: 400 });

  const { id } = await params;
  const body = await request.json();

  if (!body.date || body.amount == null) {
    return NextResponse.json({ error: "Date and amount are required" }, { status: 400 });
  }

  if (body.amount <= 0) {
    return NextResponse.json({ error: "Amount must be positive" }, { status: 400 });
  }

  const payment = recordPayment(session.activeBusiness.id, {
    invoice_id: id,
    date: body.date,
    amount: body.amount,
    method: body.method ?? "bank_transfer",
    reference: body.reference ?? null,
    notes: body.notes ?? null,
  });

  if (!payment) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  return NextResponse.json(payment, { status: 201 });
}
