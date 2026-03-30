import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { markInvoiceSent } from "@/lib/invoices";
import { sendInvoiceEmail } from "@/lib/invoices/email";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.activeBusiness) return NextResponse.json({ error: "No active business" }, { status: 400 });

  const { id } = await params;
  const businessId = session.activeBusiness.id;

  const body = await request.json().catch(() => ({}));
  const { email, subject, body: emailBody } = body;

  // Mark as sent first
  const invoice = markInvoiceSent(id, businessId);
  if (!invoice) {
    return NextResponse.json({ error: "Not found or already sent" }, { status: 404 });
  }

  // Optionally send email
  if (email || invoice.contact_email) {
    try {
      await sendInvoiceEmail(
        id,
        businessId,
        email || invoice.contact_email!,
        subject,
        emailBody
      );
    } catch (err) {
      console.error("Failed to send invoice email:", err);
      // Invoice is still marked as sent even if email fails
    }
  }

  return NextResponse.json(invoice);
}
