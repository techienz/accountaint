import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { calculateDeadlines } from "@/lib/tax/deadlines";
import { getTaxYear, getNzTaxYear } from "@/lib/tax/rules";
import { extractTotals, formatNzd } from "@/lib/reports/parsers";
import { ReportHeader } from "@/components/reports/report-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function TaxPositionPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.activeBusiness) redirect("/settings?new=true");

  const biz = session.activeBusiness;
  const db = getDb();

  // Get P&L for taxable income estimate
  const plCache = db
    .select()
    .from(schema.xeroCache)
    .where(eq(schema.xeroCache.business_id, biz.id))
    .all()
    .find((c) => c.entity_type === "profit_loss");

  const plData = plCache ? JSON.parse(plCache.data) : null;
  const totals = extractTotals(plData);

  // Tax config
  const now = new Date();
  const currentTaxYear = getNzTaxYear(now);
  const taxConfig = getTaxYear(now);
  const entityType = biz.entity_type as "company" | "sole_trader" | "partnership" | "trust";
  const taxRate =
    entityType === "company"
      ? taxConfig?.incomeTaxRate.company
      : entityType === "trust"
        ? taxConfig?.incomeTaxRate.trust
        : null; // Sole traders/partnerships use individual rates

  const estimatedTax =
    totals && taxRate ? Math.max(0, totals.netProfit * taxRate) : null;

  // Upcoming deadlines
  const sixMonthsOut = new Date(now);
  sixMonthsOut.setMonth(sixMonthsOut.getMonth() + 6);

  const deadlines = calculateDeadlines({
    entity_type: entityType,
    balance_date: biz.balance_date,
    gst_registered: biz.gst_registered,
    gst_filing_period: biz.gst_filing_period as "monthly" | "2monthly" | "6monthly" | undefined,
    has_employees: biz.has_employees,
    paye_frequency: biz.paye_frequency as "monthly" | "twice_monthly" | undefined,
    provisional_tax_method: biz.provisional_tax_method as "standard" | "estimation" | "aim" | undefined,
    dateRange: { from: now, to: sixMonthsOut },
  });

  const provisionalDeadlines = deadlines.filter((d) => d.type === "provisional_tax");
  const gstDeadlines = deadlines.filter((d) => d.type === "gst");
  const incomeDeadlines = deadlines.filter((d) => d.type === "income_tax");

  return (
    <>
      <ReportHeader title="Tax Position" />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Estimated Taxable Income
            </CardTitle>
          </CardHeader>
          <CardContent>
            {totals ? (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Net Profit (from P&L)</span>
                  <span className="font-medium">${formatNzd(totals.netProfit)}</span>
                </div>
                {taxRate !== null && estimatedTax !== null ? (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Tax rate ({entityType === "company" ? "company" : "trust"})
                      </span>
                      <span>{(taxRate! * 100).toFixed(0)}%</span>
                    </div>
                    <div className="flex justify-between text-sm border-t pt-2">
                      <span className="font-medium">Estimated tax</span>
                      <span className="font-semibold">${formatNzd(estimatedTax)}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {entityType === "sole_trader" || entityType === "partnership"
                      ? "Individual tax rates apply — consult your accountant for an accurate estimate."
                      : "Tax rate not available for this tax year."}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Sync Xero data to estimate taxable income.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Current Tax Year</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax year</span>
              <span>{currentTaxYear}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Balance date</span>
              <span>{biz.balance_date}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Provisional tax method</span>
              <span>{biz.provisional_tax_method || "Not set"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">GST registered</span>
              <span>{biz.gst_registered ? "Yes" : "No"}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Obligations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Upcoming Tax Obligations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {provisionalDeadlines.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Provisional Tax</h4>
                {provisionalDeadlines.map((d, i) => (
                  <div key={i} className="flex justify-between text-sm py-1">
                    <span>{d.description}</span>
                    <Badge variant="outline">
                      {new Date(d.dueDate).toLocaleDateString("en-NZ")}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
            {gstDeadlines.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">GST</h4>
                {gstDeadlines.slice(0, 3).map((d, i) => (
                  <div key={i} className="flex justify-between text-sm py-1">
                    <span>{d.description}</span>
                    <Badge variant="outline">
                      {new Date(d.dueDate).toLocaleDateString("en-NZ")}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
            {incomeDeadlines.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Income Tax</h4>
                {incomeDeadlines.map((d, i) => (
                  <div key={i} className="flex justify-between text-sm py-1">
                    <span>{d.description}</span>
                    <Badge variant="outline">
                      {new Date(d.dueDate).toLocaleDateString("en-NZ")}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
            {deadlines.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No upcoming obligations in the next 6 months.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
