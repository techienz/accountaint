import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getInvoice } from "./index";
import { getContact } from "@/lib/contacts";
import { generateInvoicePdf } from "./pdf";
import { sendEmail } from "@/lib/notifications/email";
import { buildEmailConfig } from "@/lib/notifications/email-config";
import { getTemplate, renderTemplate } from "@/lib/email-templates";
import { formatDateNzDash } from "@/lib/utils/format-date-nz";

export async function sendInvoiceEmail(
  invoiceId: string,
  businessId: string,
  recipientEmail: string,
  subject?: string,
  body?: string,
  ccEmails?: string[]
) {
  const invoice = getInvoice(invoiceId, businessId);
  if (!invoice) throw new Error("Invoice not found");

  const contact = getContact(invoice.contact_id, businessId);
  if (!contact) throw new Error("Contact not found");

  const db = getDb();
  const business = db
    .select()
    .from(schema.businesses)
    .where(eq(schema.businesses.id, businessId))
    .get();
  if (!business) throw new Error("Business not found");

  // Get SMTP config from notification preferences
  const prefs = db
    .select()
    .from(schema.notificationPreferences)
    .where(eq(schema.notificationPreferences.business_id, businessId))
    .all()
    .find((p) => p.channel === "email" && p.enabled);

  if (!prefs?.config) {
    throw new Error("Email not configured. Set up email in Notification Preferences.");
  }

  const rawConfig = JSON.parse(prefs.config);
  // Override the to_address with this invoice's recipient
  const emailConfig = buildEmailConfig({ ...rawConfig, to_address: recipientEmail });
  if (!emailConfig) {
    throw new Error(
      "Email not fully configured. Open Settings → Notifications → Email to fill in the missing fields."
    );
  }

  // Generate PDF
  const pdfBuffer = await generateInvoicePdf(invoice, business, contact);

  const isInvoice = invoice.type === "ACCREC";
  const template = getTemplate(businessId, "invoice");
  const fmt = (n: number) =>
    "$" + n.toLocaleString("en-NZ", { minimumFractionDigits: 2 });

  // If business has saved payment instructions, wrap them as a paragraph
  // block so placeholder rendering drops nothing in when there's nothing saved.
  const paymentInstructionsBlock = business.payment_instructions?.trim()
    ? `<p><strong>Payment details:</strong><br>${business.payment_instructions
        .replace(/\n/g, "<br>")}</p>`
    : "";

  const variables = {
    business_name: business.name,
    contact_name: contact.name,
    invoice_number: invoice.invoice_number,
    document_kind: isInvoice ? "Invoice" : "Bill",
    document_kind_lower: isInvoice ? "invoice" : "bill",
    amount_due: fmt(invoice.amount_due),
    due_date: formatDateNzDash(invoice.due_date),
    total_amount: fmt(invoice.total),
    payment_instructions: paymentInstructionsBlock,
  };

  const emailSubject = subject?.trim() || renderTemplate(template.subject, variables);
  const emailBody = body?.trim() || renderTemplate(template.body, variables);

  // Get CC emails from contact or explicit parameter
  const cc = ccEmails && ccEmails.length > 0
    ? ccEmails
    : contact.cc_emails
      ? contact.cc_emails.split(",").map((e: string) => e.trim()).filter(Boolean)
      : undefined;

  await sendEmail(emailConfig, emailSubject, emailBody, [
    {
      filename: `${invoice.invoice_number}.pdf`,
      content: pdfBuffer,
      contentType: "application/pdf",
    },
  ], cc);
}
