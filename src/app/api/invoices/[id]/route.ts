import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getInvoice, updateInvoice, deleteInvoice } from "@/lib/invoices";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.activeBusiness) return NextResponse.json({ error: "No active business" }, { status: 400 });

  const { id } = await params;
  const invoice = getInvoice(id, session.activeBusiness.id);
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(invoice);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.activeBusiness) return NextResponse.json({ error: "No active business" }, { status: 400 });

  const { id } = await params;
  const body = await request.json();
  const invoice = updateInvoice(id, session.activeBusiness.id, body);
  if (!invoice) return NextResponse.json({ error: "Not found or not editable" }, { status: 404 });

  return NextResponse.json(invoice);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.activeBusiness) return NextResponse.json({ error: "No active business" }, { status: 400 });

  const { id } = await params;
  const result = deleteInvoice(id, session.activeBusiness.id, {
    userId: session.user.id,
    source: "ui",
  });
  if (!result.ok) {
    if (result.reason === "not_found") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(
      {
        error: `Cannot delete invoice with status '${result.status}'. Paid invoices and voided invoices are protected.`,
      },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true });
}
