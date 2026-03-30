import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { ReportHeader } from "@/components/reports/report-header";
import { formatNzd } from "@/lib/reports/parsers";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { XeroInvoice } from "@/lib/xero/types";
import { parseXeroDate } from "@/lib/xero/dates";

type MonthlyFlow = {
  month: string;
  inflows: number;
  outflows: number;
  net: number;
};

function groupByMonth(invoices: XeroInvoice[]): MonthlyFlow[] {
  const monthMap = new Map<string, { inflows: number; outflows: number }>();

  for (const inv of invoices) {
    // Only count paid invoices as cash flow
    if (inv.AmountPaid <= 0) continue;

    const date = parseXeroDate(inv.Date);
    if (isNaN(date.getTime())) continue; // skip unparseable dates
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    if (!monthMap.has(key)) {
      monthMap.set(key, { inflows: 0, outflows: 0 });
    }

    const entry = monthMap.get(key)!;
    if (inv.Type === "ACCREC") {
      entry.inflows += inv.AmountPaid;
    } else {
      entry.outflows += inv.AmountPaid;
    }
  }

  return Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month,
      inflows: Math.round(data.inflows * 100) / 100,
      outflows: Math.round(data.outflows * 100) / 100,
      net: Math.round((data.inflows - data.outflows) * 100) / 100,
    }));
}

export default async function CashFlowPage() {
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

  const invoices: XeroInvoice[] = cached
    ? (JSON.parse(cached.data)?.Invoices || [])
    : [];

  const monthlyFlows = groupByMonth(invoices);

  const totalInflows = monthlyFlows.reduce((sum, m) => sum + m.inflows, 0);
  const totalOutflows = monthlyFlows.reduce((sum, m) => sum + m.outflows, 0);

  return (
    <>
      <ReportHeader title="Cash Flow" />
      <Card>
        <CardContent className="pt-6">
          {monthlyFlows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No invoice data. Sync from Xero to see cash flow.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Cash In</TableHead>
                  <TableHead className="text-right">Cash Out</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyFlows.map((m) => (
                  <TableRow key={m.month}>
                    <TableCell>
                      {formatMonth(m.month)}
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      ${formatNzd(m.inflows)}
                    </TableCell>
                    <TableCell className="text-right text-red-600">
                      ${formatNzd(m.outflows)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium ${
                        m.net >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      ${formatNzd(Math.abs(m.net))}
                      {m.net < 0 ? " (out)" : ""}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-semibold border-t-2">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right text-green-600">
                    ${formatNzd(totalInflows)}
                  </TableCell>
                  <TableCell className="text-right text-red-600">
                    ${formatNzd(totalOutflows)}
                  </TableCell>
                  <TableCell
                    className={`text-right ${
                      totalInflows - totalOutflows >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    ${formatNzd(Math.abs(totalInflows - totalOutflows))}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function formatMonth(key: string): string {
  const [y, m] = key.split("-");
  const d = new Date(parseInt(y), parseInt(m) - 1);
  return d.toLocaleDateString("en-NZ", { month: "long", year: "numeric" });
}
