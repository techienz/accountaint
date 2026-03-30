import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

type Deadline = {
  type: string;
  description: string;
  dueDate: string;
  taxYear: number;
};

function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dateStr);
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function GstCard({
  deadlines,
  filingPeriod,
}: {
  deadlines: Deadline[];
  filingPeriod: string | null;
}) {
  const nextGst = deadlines[0];

  const periodLabel =
    filingPeriod === "monthly"
      ? "Monthly"
      : filingPeriod === "2monthly"
        ? "2-monthly"
        : filingPeriod === "6monthly"
          ? "6-monthly"
          : "";

  if (!nextGst) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            GST ({periodLabel})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No upcoming GST deadlines.
          </p>
        </CardContent>
      </Card>
    );
  }

  const days = daysUntil(nextGst.dueDate);
  const variant =
    days < 0 ? "destructive" : days <= 7 ? "secondary" : "default";
  const statusText =
    days < 0
      ? `${Math.abs(days)} days overdue`
      : days === 0
        ? "Due today"
        : `${days} days`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          GST ({periodLabel})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm">{nextGst.description}</p>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Due {new Date(nextGst.dueDate).toLocaleDateString("en-NZ")}
          </span>
          <Badge variant={variant}>{statusText}</Badge>
        </div>
        <div className="border-t pt-3">
          <Link
            href="/reports/gst-history"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            View GST history →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
