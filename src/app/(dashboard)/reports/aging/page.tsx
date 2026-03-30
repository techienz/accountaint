import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { ReportHeader } from "@/components/reports/report-header";
import { formatNzd } from "@/lib/reports/parsers";
import { parseXeroDate } from "@/lib/xero/dates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { XeroInvoice } from "@/lib/xero/types";
import { listInvoices, toXeroInvoiceFormat } from "@/lib/invoices";

type AgingBucket = {
  label: string;
  invoices: { contact: string; invoiceNumber: string; amount: number; daysOverdue: number }[];
  total: number;
};

function bucketInvoices(invoices: XeroInvoice[], type: "ACCREC" | "ACCPAY"): AgingBucket[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const outstanding = invoices.filter(
    (inv) => inv.Type === type && inv.AmountDue > 0 && inv.Status !== "VOIDED" && inv.Status !== "DELETED"
  );

  const buckets: AgingBucket[] = [
    { label: "Current", invoices: [], total: 0 },
    { label: "1–30 days", invoices: [], total: 0 },
    { label: "31–60 days", invoices: [], total: 0 },
    { label: "61–90 days", invoices: [], total: 0 },
    { label: "90+ days", invoices: [], total: 0 },
  ];

  for (const inv of outstanding) {
    const dueDate = parseXeroDate(inv.DueDate);
    const daysSinceDue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

    const entry = {
      contact: inv.Contact.Name,
      invoiceNumber: inv.InvoiceNumber,
      amount: inv.AmountDue,
      daysOverdue: Math.max(0, daysSinceDue),
    };

    let bucketIndex: number;
    if (daysSinceDue <= 0) bucketIndex = 0;
    else if (daysSinceDue <= 30) bucketIndex = 1;
    else if (daysSinceDue <= 60) bucketIndex = 2;
    else if (daysSinceDue <= 90) bucketIndex = 3;
    else bucketIndex = 4;

    buckets[bucketIndex].invoices.push(entry);
    buckets[bucketIndex].total += inv.AmountDue;
  }

  return buckets;
}

export default async function AgingPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.activeBusiness) redirect("/settings?new=true");

  const biz = session.activeBusiness;
  const db = getDb();

  const cached = db
    .select()
    .from(schema.xeroCache)
    .where(eq(schema.xeroCache.business_id, biz.id))
    .all()
    .find((c) => c.entity_type === "invoices");

  const xeroInvoices: XeroInvoice[] = cached
    ? (JSON.parse(cached.data)?.Invoices || [])
    : [];

  // Merge local invoices in Xero format
  const localInvoices = listInvoices(biz.id)
    .map((inv) => {
      const fullInv = { ...inv, contact_email: null, line_items: [] };
      return toXeroInvoiceFormat(fullInv);
    })
    .filter((inv): inv is XeroInvoice => inv !== null);

  const invoices = [...xeroInvoices, ...localInvoices];

  const arBuckets = bucketInvoices(invoices, "ACCREC");
  const apBuckets = bucketInvoices(invoices, "ACCPAY");

  const arTotal = arBuckets.reduce((sum, b) => sum + b.total, 0);
  const apTotal = apBuckets.reduce((sum, b) => sum + b.total, 0);

  return (
    <>
      <ReportHeader title="AP/AR Aging" />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Accounts Receivable — ${formatNzd(arTotal)} outstanding
          </CardTitle>
        </CardHeader>
        <CardContent>
          {arTotal === 0 ? (
            <p className="text-sm text-muted-foreground">No outstanding receivables.</p>
          ) : (
            <AgingTable buckets={arBuckets} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Accounts Payable — ${formatNzd(apTotal)} outstanding
          </CardTitle>
        </CardHeader>
        <CardContent>
          {apTotal === 0 ? (
            <p className="text-sm text-muted-foreground">No outstanding payables.</p>
          ) : (
            <AgingTable buckets={apBuckets} />
          )}
        </CardContent>
      </Card>
    </>
  );
}

function AgingTable({ buckets }: { buckets: AgingBucket[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Contact</TableHead>
          <TableHead>Invoice</TableHead>
          <TableHead className="text-right">Amount Due</TableHead>
          <TableHead className="text-right">Days Overdue</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {buckets.map(
          (bucket) =>
            bucket.invoices.length > 0 && (
              <>
                <TableRow key={`header-${bucket.label}`}>
                  <TableCell
                    colSpan={4}
                    className="font-semibold bg-muted/50"
                  >
                    {bucket.label} — ${formatNzd(bucket.total)}
                  </TableCell>
                </TableRow>
                {bucket.invoices.map((inv, i) => (
                  <TableRow key={`${bucket.label}-${i}`}>
                    <TableCell className="pl-6">{inv.contact}</TableCell>
                    <TableCell>{inv.invoiceNumber}</TableCell>
                    <TableCell className="text-right">
                      ${formatNzd(inv.amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {inv.daysOverdue > 0 ? `${inv.daysOverdue}d` : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </>
            )
        )}
      </TableBody>
    </Table>
  );
}
