import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getInvoice } from "./index";
import { getContact } from "@/lib/contacts";
import { generateInvoicePdf } from "./pdf";
import { sendEmail } from "@/lib/notifications/email";
import { buildEmailConfig } from "@/lib/notifications/email-config";
import { getTemplate, renderTemplate } from "@/lib/email-templates";
import { formatDateNzDash } from "@/lib/utils/format-date-nz";
import { recordEmail } from "@/lib/email-log";
import { resolveCcRecipients } from "./resolve-cc";
import { buildOverduePhrase } from "./overdue-phrase";

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

  const cc = resolveCcRecipients(ccEmails, contact.cc_emails ?? null);

  const attachmentName = `${invoice.invoice_number}.pdf`;
  const provider = emailConfig.provider === "graph" ? "graph" : "smtp";
  try {
    await sendEmail(emailConfig, emailSubject, emailBody, [
      {
        filename: attachmentName,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ], cc);
    recordEmail({
      businessId,
      kind: "invoice",
      provider,
      fromAddress: emailConfig.from_address,
      toAddress: recipientEmail,
      ccAddresses: cc && cc.length > 0 ? cc : null,
      subject: emailSubject,
      attachmentNames: [attachmentName],
      success: true,
      relatedEntityType: "invoice",
      relatedEntityId: invoiceId,
    });
  } catch (err) {
    recordEmail({
      businessId,
      kind: "invoice",
      provider,
      fromAddress: emailConfig.from_address,
      toAddress: recipientEmail,
      ccAddresses: cc && cc.length > 0 ? cc : null,
      subject: emailSubject,
      attachmentNames: [attachmentName],
      success: false,
      errorMessage: err instanceof Error ? err.message : String(err),
      relatedEntityType: "invoice",
      relatedEntityId: invoiceId,
    });
    throw err;
  }
}

/**
 * Send a payment-reminder email for an unpaid invoice. Uses the
 * `invoice_reminder` template (overridable per business in Settings →
 * Email Templates) and bumps `last_reminder_sent_at` + `reminder_count`
 * on success. Refuses to send for paid/void invoices.
 */
export async function sendInvoiceReminder(
  invoiceId: string,
  businessId: string,
  recipientEmailOverride?: string,
  ccEmails?: string[]
) {
  const invoice = getInvoice(invoiceId, businessId);
  if (!invoice) throw new Error("Invoice not found");
  if (invoice.type !== "ACCREC") throw new Error("Reminders are for sales invoices only");
  if (invoice.status === "paid" || invoice.status === "void" || invoice.status === "draft") {
    throw new Error(`Reminders only apply to sent or overdue invoices (current status: ${invoice.status})`);
  }
  if (invoice.amount_due <= 0) throw new Error("Nothing outstanding to remind about");

  const contact = getContact(invoice.contact_id, businessId);
  if (!contact) throw new Error("Contact not found");

  const recipient = recipientEmailOverride || invoice.contact_email;
  if (!recipient) throw new Error("No recipient email — pass one or save it on the contact.");

  const db = getDb();
  const business = db
    .select()
    .from(schema.businesses)
    .where(eq(schema.businesses.id, businessId))
    .get();
  if (!business) throw new Error("Business not found");

  const prefs = db
    .select()
    .from(schema.notificationPreferences)
    .where(eq(schema.notificationPreferences.business_id, businessId))
    .all()
    .find((p) => p.channel === "email" && p.enabled);
  if (!prefs?.config) throw new Error("Email not configured. Set up email in Notification Preferences.");

  const rawConfig = JSON.parse(prefs.config);
  const emailConfig = buildEmailConfig({ ...rawConfig, to_address: recipient });
  if (!emailConfig) throw new Error("Email not fully configured. Open Settings → Notifications → Email.");

  const pdfBuffer = await generateInvoicePdf(invoice, business, contact);

  const template = getTemplate(businessId, "invoice_reminder");
  const fmt = (n: number) =>
    "$" + n.toLocaleString("en-NZ", { minimumFractionDigits: 2 });

  const paymentInstructionsBlock = business.payment_instructions?.trim()
    ? `<p><strong>Payment details:</strong><br>${business.payment_instructions.replace(/\n/g, "<br>")}</p>`
    : "";

  const variables = {
    business_name: business.name,
    contact_name: contact.name,
    invoice_number: invoice.invoice_number,
    amount_due: fmt(invoice.amount_due),
    due_date: formatDateNzDash(invoice.due_date),
    overdue_phrase: buildOverduePhrase(invoice.due_date, new Date()),
    payment_instructions: paymentInstructionsBlock,
  };

  const emailSubject = renderTemplate(template.subject, variables);
  const emailBody = renderTemplate(template.body, variables);

  const cc = resolveCcRecipients(ccEmails, contact.cc_emails ?? null);
  const attachmentName = `${invoice.invoice_number}.pdf`;
  const provider = emailConfig.provider === "graph" ? "graph" : "smtp";

  try {
    await sendEmail(emailConfig, emailSubject, emailBody, [
      { filename: attachmentName, content: pdfBuffer, contentType: "application/pdf" },
    ], cc);
    recordEmail({
      businessId,
      kind: "invoice_reminder",
      provider,
      fromAddress: emailConfig.from_address,
      toAddress: recipient,
      ccAddresses: cc && cc.length > 0 ? cc : null,
      subject: emailSubject,
      attachmentNames: [attachmentName],
      success: true,
      relatedEntityType: "invoice",
      relatedEntityId: invoiceId,
    });
    db.update(schema.invoices)
      .set({
        last_reminder_sent_at: new Date(),
        reminder_count: (invoice.reminder_count ?? 0) + 1,
        updated_at: new Date(),
      })
      .where(eq(schema.invoices.id, invoiceId))
      .run();
  } catch (err) {
    recordEmail({
      businessId,
      kind: "invoice_reminder",
      provider,
      fromAddress: emailConfig.from_address,
      toAddress: recipient,
      ccAddresses: cc && cc.length > 0 ? cc : null,
      subject: emailSubject,
      attachmentNames: [attachmentName],
      success: false,
      errorMessage: err instanceof Error ? err.message : String(err),
      relatedEntityType: "invoice",
      relatedEntityId: invoiceId,
    });
    throw err;
  }
}
