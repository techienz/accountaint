import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { generateGstPeriods, formatPeriod } from "@/lib/gst/periods";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { statusColors, statusLabels } from "@/lib/tax/urgency";

export default async function GstPeriodsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const business = session.activeBusiness;
  if (!business) redirect("/onboarding");

  if (!business.gst_registered) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">GST Returns</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              This business is not GST registered.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const periods = generateGstPeriods(
    business.gst_filing_period || "2monthly",
    business.balance_date,
    8
  );

  // Load filing statuses
  const db = getDb();
  const statuses = await db
    .select()
    .from(schema.filingStatus)
    .where(eq(schema.filingStatus.business_id, business.id));

  const gstStatuses = statuses.filter((s) => s.filing_type === "gst");

  // Audit #115 — surface basis on every GST surface.
  const basis = business.gst_basis === "payments" ? "Payments" : "Invoice";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">GST Returns</h1>
        <p className="text-muted-foreground">
          Select a period to prepare your GST101A return · <span className="font-medium">{basis} basis</span>
        </p>
      </div>

      <div className="space-y-3">
        {periods.map((period) => {
          const periodKey = `${period.from}_${period.to}`;
          const status = gstStatuses.find(
            (s) => s.period_key === periodKey
          );
          const statusVal = status?.status || "not_started";

          return (
            <Card key={periodKey}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-4">
                  <Badge
                    className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                    variant="secondary"
                  >
                    GST
                  </Badge>
                  <div>
                    <p className="font-medium">
                      {formatPeriod(period.from, period.to)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    className={statusColors[statusVal] || ""}
                    variant="secondary"
                  >
                    {statusLabels[statusVal] || statusVal}
                  </Badge>
                  <Link href={`/tax-prep/gst/${periodKey}`}>
                    <Button variant="outline" size="sm">
                      Open <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
