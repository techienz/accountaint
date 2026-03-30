import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import type { XeroInvoice } from "@/lib/xero/types";

function formatNzd(value: number): string {
  return value.toLocaleString("en-NZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function ApArCard({
  invoices,
  connected,
}: {
  invoices: XeroInvoice[] | null;
  connected: boolean;
}) {
  if (!connected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">AP/AR</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            <Link href="/settings/xero" className="text-primary hover:underline">
              Connect Xero
            </Link>{" "}
            to see receivables and payables.
          </p>
        </CardContent>
      </Card>
    );
  }

  const outstanding = (invoices || []).filter(
    (inv) => inv.AmountDue > 0 && inv.Status !== "VOIDED" && inv.Status !== "DELETED"
  );

  const totalReceivable = outstanding
    .filter((inv) => inv.Type === "ACCREC")
    .reduce((sum, inv) => sum + inv.AmountDue, 0);

  const totalPayable = outstanding
    .filter((inv) => inv.Type === "ACCPAY")
    .reduce((sum, inv) => sum + inv.AmountDue, 0);

  // Find oldest overdue
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const overdue = outstanding.filter((inv) => new Date(inv.DueDate) < now);
  const oldestOverdue = overdue.sort(
    (a, b) => new Date(a.DueDate).getTime() - new Date(b.DueDate).getTime()
  )[0];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">AP/AR</CardTitle>
        <Link
          href="/reports/aging"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          View report
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Receivable</span>
          <span className="font-medium text-green-600">
            ${formatNzd(totalReceivable)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Payable</span>
          <span className="font-medium text-red-600">
            ${formatNzd(totalPayable)}
          </span>
        </div>
        {oldestOverdue && (
          <div className="border-t pt-3">
            <p className="text-xs text-amber-600">
              Oldest overdue: {oldestOverdue.Contact.Name} — ${formatNzd(oldestOverdue.AmountDue)}{" "}
              (due {new Date(oldestOverdue.DueDate).toLocaleDateString("en-NZ")})
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
