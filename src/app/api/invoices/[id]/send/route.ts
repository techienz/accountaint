import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getInvoice, markInvoiceSent } from "@/lib/invoices";
import { sendInvoiceEmail } from "@/lib/invoices/email";

/**
 * Send an invoice email.
 *
 * If the invoice is still a draft, this also transitions it to "sent" and
 * posts the corresponding journal entry. Once sent, subsequent calls just
 * re-email (useful for resending or sending a test to yourself before the
 * real send — no state changes on re-send).
 */
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

  let invoice = getInvoice(id, businessId);
  if (!invoice) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (invoice.type === "ACCPAY") {
    return NextResponse.json(
      { error: "Bills can't be sent via this flow" },
      { status: 400 }
    );
  }

  // First send: transition draft → sent and post journal. Re-sends are no-ops here.
  if (invoice.status === "draft") {
    const updated = markInvoiceSent(id, businessId);
    if (updated) invoice = updated;
  }

  // Send email (always, including on re-send). Failures don't roll back status.
  const recipient = email || invoice.contact_email;
  if (recipient) {
    try {
      await sendInvoiceEmail(
        id,
        businessId,
        recipient,
        subject,
        emailBody
      );
    } catch (err) {
      console.error("Failed to send invoice email:", err);
      const message = err instanceof Error ? err.message : "Send failed";
      return NextResponse.json(
        { ...invoice, email_error: message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ...invoice, emailed_to: recipient ?? null });
}
