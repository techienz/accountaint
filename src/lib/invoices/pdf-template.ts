import { readFileSync } from "fs";
import { join } from "path";
import { decrypt } from "@/lib/encryption";

type PdfInvoiceData = {
  invoice: {
    invoice_number: string;
    type: string;
    date: string;
    due_date: string;
    reference: string | null;
    subtotal: number;
    gst_total: number;
    total: number;
    amount_paid: number;
    amount_due: number;
    notes: string | null;
    payment_instructions: string | null;
    line_items: Array<{
      description: string;
      quantity: number;
      unit_price: number;
      gst_rate: number;
      line_total: number;
      gst_amount: number;
    }>;
  };
  business: {
    name: string;
    ird_number: string | null;
    nzbn: string | null;
    registered_office: string | null;
    invoice_logo_path: string | null;
    invoice_custom_footer: string | null;
    invoice_show_branding: boolean;
  };
  contact: {
    name: string;
    email: string | null;
    address: string | null;
    tax_number: string | null;
  };
};

function formatNzd(value: number): string {
  return value.toLocaleString("en-NZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getLogoDataUri(logoPath: string | null): string | null {
  if (!logoPath) return null;
  try {
    const fullPath = join(process.cwd(), "data", logoPath);
    const buffer = readFileSync(fullPath);
    const ext = logoPath.split(".").pop()?.toLowerCase() || "png";
    const mime = ext === "svg" ? "image/svg+xml" : `image/${ext}`;
    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

export function renderInvoiceHtml(data: PdfInvoiceData): string {
  const { invoice, business, contact } = data;
  const isInvoice = invoice.type === "ACCREC";
  const docType = isInvoice ? "TAX INVOICE" : "BILL";

  const logoUri = getLogoDataUri(business.invoice_logo_path);
  const irdNumber = business.ird_number ? decrypt(business.ird_number) : null;
  const nzbn = business.nzbn ? decrypt(business.nzbn) : null;
  const officeAddress = business.registered_office
    ? decrypt(business.registered_office)
    : null;

  const lineItemRows = invoice.line_items
    .map(
      (li) => `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e5e5;">${escapeHtml(li.description)}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e5e5; text-align: right;">${li.quantity}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e5e5; text-align: right;">$${formatNzd(li.unit_price)}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e5e5; text-align: right;">${Math.round(li.gst_rate * 100)}%</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e5e5; text-align: right;">$${formatNzd(li.line_total)}</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; font-size: 13px; line-height: 1.5; }
  .container { max-width: 800px; margin: 0 auto; padding: 40px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
  .doc-type { font-size: 28px; font-weight: 700; color: #111; letter-spacing: -0.5px; }
  .meta-table td { padding: 2px 0; }
  .meta-label { color: #666; padding-right: 16px; }
  .parties { display: flex; justify-content: space-between; margin-bottom: 32px; }
  .party { max-width: 45%; }
  .party-label { font-size: 11px; text-transform: uppercase; color: #888; letter-spacing: 0.5px; margin-bottom: 4px; }
  .party-name { font-weight: 600; font-size: 15px; }
  table.items { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  table.items th { text-align: left; padding: 10px 12px; border-bottom: 2px solid #111; font-size: 11px; text-transform: uppercase; color: #666; letter-spacing: 0.5px; }
  table.items th:not(:first-child) { text-align: right; }
  .totals { margin-left: auto; width: 280px; }
  .totals table { width: 100%; }
  .totals td { padding: 6px 0; }
  .totals .total-row td { font-weight: 700; font-size: 16px; border-top: 2px solid #111; padding-top: 10px; }
  .notes { margin-top: 32px; padding: 16px; background: #f8f8f8; border-radius: 6px; font-size: 12px; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e5e5; font-size: 11px; color: #888; text-align: center; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div>
      ${logoUri ? `<img src="${logoUri}" alt="" style="max-height: 60px; max-width: 200px; margin-bottom: 12px;">` : ""}
      <div class="doc-type">${docType}</div>
    </div>
    <table class="meta-table">
      <tr><td class="meta-label">Number</td><td><strong>${escapeHtml(invoice.invoice_number)}</strong></td></tr>
      <tr><td class="meta-label">Date</td><td>${invoice.date}</td></tr>
      <tr><td class="meta-label">Due Date</td><td>${invoice.due_date}</td></tr>
      ${invoice.reference ? `<tr><td class="meta-label">Reference</td><td>${escapeHtml(invoice.reference)}</td></tr>` : ""}
    </table>
  </div>

  <div class="parties">
    <div class="party">
      <div class="party-label">From</div>
      <div class="party-name">${escapeHtml(business.name)}</div>
      ${officeAddress ? `<div>${escapeHtml(officeAddress)}</div>` : ""}
      ${irdNumber ? `<div>IRD: ${escapeHtml(irdNumber)}</div>` : ""}
      ${nzbn ? `<div>NZBN: ${escapeHtml(nzbn)}</div>` : ""}
    </div>
    <div class="party">
      <div class="party-label">${isInvoice ? "Bill To" : "From"}</div>
      <div class="party-name">${escapeHtml(contact.name)}</div>
      ${contact.address ? `<div>${escapeHtml(contact.address)}</div>` : ""}
      ${contact.email ? `<div>${escapeHtml(contact.email)}</div>` : ""}
      ${contact.tax_number ? `<div>Tax #: ${escapeHtml(contact.tax_number)}</div>` : ""}
    </div>
  </div>

  <table class="items">
    <thead>
      <tr>
        <th>Description</th>
        <th>Qty</th>
        <th>Unit Price</th>
        <th>GST</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>
      ${lineItemRows}
    </tbody>
  </table>

  <div class="totals">
    <table>
      <tr><td>Subtotal</td><td style="text-align: right;">$${formatNzd(invoice.subtotal)}</td></tr>
      <tr><td>GST</td><td style="text-align: right;">$${formatNzd(invoice.gst_total)}</td></tr>
      <tr class="total-row"><td>Total</td><td style="text-align: right;">$${formatNzd(invoice.total)}</td></tr>
      ${invoice.amount_paid > 0 ? `<tr><td>Paid</td><td style="text-align: right;">$${formatNzd(invoice.amount_paid)}</td></tr>` : ""}
      ${invoice.amount_due !== invoice.total ? `<tr><td><strong>Amount Due</strong></td><td style="text-align: right;"><strong>$${formatNzd(invoice.amount_due)}</strong></td></tr>` : ""}
    </table>
  </div>

  ${invoice.payment_instructions ? `<div class="notes"><strong>Payment Instructions</strong><br>${escapeHtml(invoice.payment_instructions)}</div>` : ""}
  ${invoice.notes ? `<div class="notes" style="margin-top: 12px;"><strong>Notes</strong><br>${escapeHtml(invoice.notes)}</div>` : ""}

  ${business.invoice_custom_footer ? `<div class="footer">${escapeHtml(business.invoice_custom_footer)}</div>` : ""}
  ${business.invoice_show_branding ? `<div class="footer"${business.invoice_custom_footer ? ' style="margin-top: 4px;"' : ""}>Generated by Accountaint</div>` : ""}
</div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "<br>");
}
