import type { XeroInvoice } from "@/lib/xero/types";

export type GstPeriod = {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
};

export type GstLineItem = {
  description: string;
  contactName: string;
  invoiceNumber: string;
  type: "sales" | "purchases";
  amount: number;
  gst: number;
};

export type GstReturnResult = {
  period: GstPeriod;
  basis: "invoice" | "payments";
  gstRate: number;
  totalSales: number;
  totalPurchases: number;
  gstOnSales: number;
  gstOnPurchases: number;
  netGst: number;
  lineItems: GstLineItem[];
};

export function calculateGstReturn(
  invoices: XeroInvoice[],
  period: GstPeriod,
  basis: "invoice" | "payments",
  gstRate: number
): GstReturnResult {
  const periodFrom = new Date(period.from);
  const periodTo = new Date(period.to);

  // Filter invoices within the period
  // Invoice basis: filter by invoice Date
  // Payments basis: use invoice date as proxy (limitation — cached data lacks payment dates)
  const periodInvoices = invoices.filter((inv) => {
    if (inv.Status === "DRAFT" || inv.Status === "DELETED" || inv.Status === "VOIDED") return false;
    const invDate = new Date(inv.Date);
    return invDate >= periodFrom && invDate <= periodTo;
  });

  const lineItems: GstLineItem[] = [];
  let totalSales = 0;
  let totalPurchases = 0;
  let gstOnSales = 0;
  let gstOnPurchases = 0;

  for (const inv of periodInvoices) {
    const isSales = inv.Type === "ACCREC";
    const totalExGst = inv.Total / (1 + gstRate);
    const gstAmount = inv.Total - totalExGst;

    if (isSales) {
      totalSales += totalExGst;
      gstOnSales += gstAmount;
    } else {
      totalPurchases += totalExGst;
      gstOnPurchases += gstAmount;
    }

    lineItems.push({
      description: inv.LineItems?.[0]?.Description || `Invoice ${inv.InvoiceNumber}`,
      contactName: inv.Contact.Name,
      invoiceNumber: inv.InvoiceNumber,
      type: isSales ? "sales" : "purchases",
      amount: round2(totalExGst),
      gst: round2(gstAmount),
    });
  }

  return {
    period,
    basis,
    gstRate,
    totalSales: round2(totalSales),
    totalPurchases: round2(totalPurchases),
    gstOnSales: round2(gstOnSales),
    gstOnPurchases: round2(gstOnPurchases),
    netGst: round2(gstOnSales - gstOnPurchases),
    lineItems,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
