import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listInvoices } from "@/lib/invoices";
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

type MonthlyFlow = {
  month: string;
  inflows: number;
  outflows: number;
  net: number;
};

function groupByMonth(
  invoices: ReturnType<typeof listInvoices>
): MonthlyFlow[] {
  const monthMap = new Map<string, { inflows: number; outflows: number }>();

  for (const inv of invoices) {
    // Only count paid invoices as cash flow
    if (inv.status !== "paid") continue;

    const date = new Date(inv.date);
    if (isNaN(date.getTime())) continue;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    if (!monthMap.has(key)) {
      monthMap.set(key, { inflows: 0, outflows: 0 });
    }

    const entry = monthMap.get(key)!;
    if (inv.type === "ACCREC") {
      entry.inflows += inv.total;
    } else {
      entry.outflows += inv.total;
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

function formatMonth(key: string): string {
  const [y, m] = key.split("-");
  const d = new Date(parseInt(y), parseInt(m) - 1);
  return d.toLocaleDateString("en-NZ", { month: "long", year: "numeric" });
}

export default async function CashFlowPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.activeBusiness) redirect("/settings?new=true");

  const biz = session.activeBusiness;

  const invoices = listInvoices(biz.id);
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
              No paid invoices recorded yet. Mark invoices as paid to see cash flow here.
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
                    <TableCell>{formatMonth(m.month)}</TableCell>
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
