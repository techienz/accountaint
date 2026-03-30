import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { voidInvoice } from "@/lib/invoices";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.activeBusiness) return NextResponse.json({ error: "No active business" }, { status: 400 });

  const { id } = await params;
  const invoice = voidInvoice(id, session.activeBusiness.id);
  if (!invoice) return NextResponse.json({ error: "Not found or already void" }, { status: 404 });

  return NextResponse.json(invoice);
}
