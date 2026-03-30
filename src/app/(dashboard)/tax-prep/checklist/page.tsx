import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { calculateDeadlines, type DeadlineInput } from "@/lib/tax/deadlines";
import { generateGstPeriods, formatPeriod } from "@/lib/gst/periods";
import { getNzTaxYear } from "@/lib/tax/rules";
import { decrypt } from "@/lib/encryption";
import {
  getUrgencyInfo,
  typeColors,
  typeLabels,
  statusColors,
  statusLabels,
} from "@/lib/tax/urgency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

function formatDisplayDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

type ChecklistItem = {
  type: string;
  label: string;
  dueDate: string | null;
  status: string;
  href: string;
};

export default async function FilingChecklistPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const business = session.activeBusiness;
  if (!business) redirect("/onboarding");

  const db = getDb();
  const taxYear = getNzTaxYear(new Date());

  // Load all filing statuses
  const allStatuses = await db
    .select()
    .from(schema.filingStatus)
    .where(eq(schema.filingStatus.business_id, business.id));

  // Calculate deadlines for the next 12 months
  const now = new Date();
  const to = new Date(now);
  to.setFullYear(to.getFullYear() + 1);

  const deadlineInput: DeadlineInput = {
    entity_type: business.entity_type as DeadlineInput["entity_type"],
    balance_date: business.balance_date,
    gst_registered: business.gst_registered,
    gst_filing_period:
      business.gst_filing_period as DeadlineInput["gst_filing_period"],
    has_employees: business.has_employees,
    paye_frequency: business.paye_frequency as DeadlineInput["paye_frequency"],
    provisional_tax_method:
      business.provisional_tax_method as DeadlineInput["provisional_tax_method"],
    dateRange: { from: now, to },
  };

  const deadlines = calculateDeadlines(deadlineInput);
  const items: ChecklistItem[] = [];

  // GST Returns
  if (business.gst_registered) {
    const periods = generateGstPeriods(
      business.gst_filing_period || "2monthly",
      business.balance_date,
      6
    );

    for (const period of periods) {
      const periodKey = `${period.from}_${period.to}`;
      const filing = allStatuses.find(
        (s) => s.filing_type === "gst" && s.period_key === periodKey
      );
      const deadline = deadlines.find(
        (d) =>
          d.type === "gst" &&
          d.description.includes(
            new Date(period.to + "T00:00:00").toLocaleDateString("en-NZ", {
              month: "short",
            })
          )
      );

      items.push({
        type: "gst",
        label: `GST Return — ${formatPeriod(period.from, period.to)}`,
        dueDate: deadline?.dueDate || null,
        status: filing?.status || "not_started",
        href: `/tax-prep/gst/${periodKey}`,
      });
    }
  }

  // IR4 Company Return
  const ir4Filing = allStatuses.find(
    (s) => s.filing_type === "ir4" && s.period_key === String(taxYear)
  );
  const terminalDeadline = deadlines.find((d) => d.type === "income_tax");

  items.push({
    type: "ir4",
    label: `IR4 Company Return — ${taxYear} tax year`,
    dueDate: terminalDeadline?.dueDate || null,
    status: ir4Filing?.status || "not_started",
    href: "/tax-prep/ir4",
  });

  // IR3 Personal Returns
  const shRows = await db
    .select()
    .from(schema.shareholders)
    .where(eq(schema.shareholders.business_id, business.id));

  for (const sh of shRows) {
    const filing = allStatuses.find(
      (s) =>
        s.filing_type === "ir3" &&
        s.period_key === String(taxYear) &&
        s.shareholder_id === sh.id
    );

    items.push({
      type: "ir3",
      label: `IR3 Personal Return — ${decrypt(sh.name)}`,
      dueDate: terminalDeadline?.dueDate || null,
      status: filing?.status || "not_started",
      href: `/tax-prep/ir3/${sh.id}`,
    });
  }

  // Provisional Tax
  if (business.provisional_tax_method) {
    const provDeadlines = deadlines.filter(
      (d) => d.type === "provisional_tax"
    );
    for (const pd of provDeadlines) {
      items.push({
        type: "provisional_tax",
        label: pd.description,
        dueDate: pd.dueDate,
        status: "not_started", // tracked via payments, not filing status
        href: "/tax-prep/provisional",
      });
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Filing Checklist</h1>
        <p className="text-muted-foreground">
          Track your filing obligations for the {taxYear} tax year
        </p>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              No filing obligations found. Check your business settings.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => {
            const urgency = item.dueDate
              ? getUrgencyInfo(item.dueDate)
              : null;

            return (
              <Card key={`${item.type}-${index}`}>
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-4">
                    <Badge
                      className={typeColors[item.type] || ""}
                      variant="secondary"
                    >
                      {typeLabels[item.type] || item.type.toUpperCase()}
                    </Badge>
                    <div>
                      <p className="font-medium">{item.label}</p>
                      {item.dueDate && (
                        <p className="text-xs text-muted-foreground">
                          Due {formatDisplayDate(item.dueDate)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      className={statusColors[item.status] || ""}
                      variant="secondary"
                    >
                      {statusLabels[item.status] || item.status}
                    </Badge>
                    {urgency && (
                      <Badge className={urgency.className} variant="secondary">
                        {urgency.label}
                      </Badge>
                    )}
                    <Link href={item.href}>
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
      )}
    </div>
  );
}
