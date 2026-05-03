import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { calculateGstReturnFromLedger, type GstBasis } from "@/lib/gst/calculator";
import { generateGstPeriods, formatPeriod } from "@/lib/gst/periods";
import { getTaxYear } from "@/lib/tax/rules";
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

export default async function GstHistoryPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.activeBusiness) redirect("/settings?new=true");

  const biz = session.activeBusiness;

  if (!biz.gst_registered) {
    return (
      <>
        <ReportHeader title="GST History" />
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              This business is not GST registered.
            </p>
          </CardContent>
        </Card>
      </>
    );
  }

  const taxConfig = getTaxYear(new Date());
  const gstRate = taxConfig?.gstRate || 0.15;

  const periods = generateGstPeriods(
    biz.gst_filing_period || "2monthly",
    biz.balance_date,
    6
  );

  // Pass the business's configured basis through (default invoice for legacy
  // businesses without it set). Audit #115 / #76.
  const basis: GstBasis =
    biz.gst_basis === "payments" ? "payments" : biz.gst_basis === "hybrid" ? "hybrid" : "invoice";
  const basisLabel = basis === "payments" ? "Payments" : basis === "hybrid" ? "Hybrid" : "Invoice";
  const results = periods
    .map((period) => calculateGstReturnFromLedger(biz.id, period, basis, gstRate))
    .filter((r): r is Extract<typeof r, { empty?: false }> => !("empty" in r) || !r.empty);
  const caveats = results.flatMap((r) =>
    r.basisCaveat ? [{ period: r.period, caveat: r.basisCaveat }] : []
  );

  return (
    <>
      <ReportHeader title="GST History" />
      <p className="text-xs text-muted-foreground -mt-3 mb-3">
        Computed from posted journal entries · <span className="font-medium">{basisLabel} basis</span>
      </p>
      {caveats.length > 0 && (
        <ul className="-mt-2 mb-3 space-y-1 text-xs text-amber-700">
          {caveats.map((c, i) => (
            <li key={i}>
              <span className="font-medium">{formatPeriod(c.period.from, c.period.to)}:</span>{" "}
              {c.caveat}
            </li>
          ))}
        </ul>
      )}
      <Card>
        <CardContent className="pt-6">
          {results.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No GST data recorded yet. Post invoices or journal entries with GST to see history here.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Sales (ex GST)</TableHead>
                  <TableHead className="text-right">Purchases (ex GST)</TableHead>
                  <TableHead className="text-right">GST Collected</TableHead>
                  <TableHead className="text-right">GST Paid</TableHead>
                  <TableHead className="text-right">Net GST</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      {formatPeriod(r.period.from, r.period.to)}
                    </TableCell>
                    <TableCell className="text-right">
                      ${formatNzd(r.totalSales)}
                    </TableCell>
                    <TableCell className="text-right">
                      ${formatNzd(r.totalPurchases)}
                    </TableCell>
                    <TableCell className="text-right">
                      ${formatNzd(r.gstOnSales)}
                    </TableCell>
                    <TableCell className="text-right">
                      ${formatNzd(r.gstOnPurchases)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium ${
                        r.netGst >= 0 ? "text-red-600" : "text-green-600"
                      }`}
                    >
                      ${formatNzd(Math.abs(r.netGst))}
                      {r.netGst >= 0 ? " payable" : " refund"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
