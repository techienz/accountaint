import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sendInvoiceReminder } from "@/lib/invoices/email";
import { getInvoice } from "@/lib/invoices";

/**
 * Manually send a payment-reminder email for an unpaid invoice. The auto
 * cron does this too on a 7-day cadence (configurable per business), but
 * the user can always trigger it earlier from the invoice detail page.
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
  const { email, cc_emails } = body;
  const ccArg = Array.isArray(cc_emails) ? cc_emails : undefined;

  try {
    await sendInvoiceReminder(id, businessId, email || undefined, ccArg);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send reminder";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const updated = getInvoice(id, businessId);
  return NextResponse.json({ ...updated, reminded_to: email || updated?.contact_email || null });
}
