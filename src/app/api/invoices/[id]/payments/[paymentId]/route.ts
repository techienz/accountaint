import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { deletePayment } from "@/lib/invoices/payments";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.activeBusiness) return NextResponse.json({ error: "No active business" }, { status: 400 });

  const { paymentId } = await params;
  const result = deletePayment(paymentId, session.activeBusiness.id);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ success: true });
}
