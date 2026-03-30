import { renderInvoiceHtml } from "./pdf-template";

type InvoiceForPdf = {
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

type BusinessForPdf = {
  name: string;
  ird_number: string | null;
  nzbn: string | null;
  registered_office: string | null;
  invoice_logo_path: string | null;
  invoice_custom_footer: string | null;
  invoice_show_branding: boolean;
};

type ContactForPdf = {
  name: string;
  email: string | null;
  address: string | null;
  tax_number: string | null;
};

export async function generateInvoicePdf(
  invoice: InvoiceForPdf,
  business: BusinessForPdf,
  contact: ContactForPdf
): Promise<Buffer> {
  const html = renderInvoiceHtml({ invoice, business, contact });

  // Dynamic import to avoid loading Puppeteer at startup
  const puppeteer = await import("puppeteer");
  const browser = await puppeteer.default.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" },
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
