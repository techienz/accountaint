import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { calculateDeadlines } from "@/lib/tax/deadlines";
import { parseDateLocal } from "@/lib/utils/dates";
import type { DeadlineInput } from "@/lib/tax/deadlines";
import { getUrgencyInfo, typeColors, typeLabels } from "@/lib/tax/urgency";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExplainButton } from "@/components/explain-button";
import { SetPageContext } from "@/components/page-context-provider";
import { PAGE_CONTEXTS } from "@/lib/help/page-context";

function formatDisplayDate(dateStr: string): string {
  const date = parseDateLocal(dateStr);
  return date.toLocaleDateString("en-NZ", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function DeadlinesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const business = session.activeBusiness;
  if (!business) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Tax Deadlines</h1>
        <p className="text-muted-foreground">
          Please add a business first to see your tax deadlines.
        </p>
      </div>
    );
  }

  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const to = new Date(from);
  to.setFullYear(to.getFullYear() + 1);

  const input: DeadlineInput = {
    entity_type: business.entity_type as DeadlineInput["entity_type"],
    balance_date: business.balance_date,
    gst_registered: business.gst_registered,
    gst_filing_period: business.gst_filing_period as DeadlineInput["gst_filing_period"],
    has_employees: business.has_employees,
    paye_frequency: business.paye_frequency as DeadlineInput["paye_frequency"],
    provisional_tax_method: business.provisional_tax_method as DeadlineInput["provisional_tax_method"],
    incorporation_date: business.incorporation_date ?? undefined,
    fbt_registered: business.fbt_registered ?? false,
    pays_contractors: business.pays_contractors ?? false,
    dateRange: { from, to },
  };

  const deadlines = calculateDeadlines(input);

  return (
    <div className="space-y-6">
      <SetPageContext context={PAGE_CONTEXTS.deadlines} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tax Deadlines</h1>
          <p className="text-muted-foreground">
            Upcoming tax obligations for {business.name} — next 12 months
          </p>
        </div>
        <ExplainButton context={PAGE_CONTEXTS.deadlines} />
      </div>

      {deadlines.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              No upcoming deadlines found. Check your business settings to ensure
              tax obligations are configured.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {deadlines.map((deadline, index) => {
            const urgency = getUrgencyInfo(deadline.dueDate);
            return (
              <Card key={`${deadline.type}-${deadline.dueDate}-${index}`}>
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-4">
                    <Badge
                      className={typeColors[deadline.type] || ""}
                      variant="secondary"
                    >
                      {typeLabels[deadline.type] || deadline.type}
                    </Badge>
                    <div>
                      <p className="font-medium">{deadline.description}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDisplayDate(deadline.dueDate)}
                      </p>
                    </div>
                  </div>
                  <Badge className={urgency.className} variant="secondary">
                    {urgency.label}
                  </Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
