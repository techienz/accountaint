import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getInvoice } from "./index";
import { getContact } from "@/lib/contacts";
import { generateInvoicePdf } from "./pdf";
import { sendEmail, type SmtpConfig } from "@/lib/notifications/email";
import { decrypt } from "@/lib/crypto";

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

  const config = JSON.parse(prefs.config);
  if (!config.smtp_host) {
    throw new Error("SMTP not configured.");
  }

  const smtpConfig: SmtpConfig = {
    smtp_host: config.smtp_host,
    smtp_port: config.smtp_port || 587,
    smtp_user: config.smtp_user || "",
    smtp_pass: config.smtp_pass ? decrypt(config.smtp_pass) : "",
    from_address: config.from_address || config.smtp_user || "",
    to_address: recipientEmail,
  };

  // Generate PDF
  const pdfBuffer = await generateInvoicePdf(invoice, business, contact);

  const isInvoice = invoice.type === "ACCREC";
  const emailSubject =
    subject ||
    `${isInvoice ? "Invoice" : "Bill"} ${invoice.invoice_number} from ${business.name}`;
  const emailBody =
    body ||
    `<p>Please find attached ${isInvoice ? "invoice" : "bill"} ${invoice.invoice_number}.</p>
     <p>Amount due: $${invoice.amount_due.toLocaleString("en-NZ", { minimumFractionDigits: 2 })}</p>
     <p>Due date: ${invoice.due_date}</p>`;

  // Get CC emails from contact or explicit parameter
  const cc = ccEmails && ccEmails.length > 0
    ? ccEmails
    : contact.cc_emails
      ? contact.cc_emails.split(",").map((e: string) => e.trim()).filter(Boolean)
      : undefined;

  await sendEmail(smtpConfig, emailSubject, emailBody, [
    {
      filename: `${invoice.invoice_number}.pdf`,
      content: pdfBuffer,
      contentType: "application/pdf",
    },
  ], cc);
}
