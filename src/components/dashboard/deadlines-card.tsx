import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { parseDateLocal } from "@/lib/utils/dates";

type Deadline = {
  type: string;
  description: string;
  dueDate: string;
  taxYear: number;
};

function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = parseDateLocal(dateStr);
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

const typeColors: Record<string, string> = {
  gst: "bg-blue-100 text-blue-800",
  provisional_tax: "bg-purple-100 text-purple-800",
  income_tax: "bg-green-100 text-green-800",
  paye: "bg-orange-100 text-orange-800",
};

export function DeadlinesCard({ deadlines }: { deadlines: Deadline[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">Upcoming Deadlines</CardTitle>
        <Link
          href="/deadlines"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          View all
        </Link>
      </CardHeader>
      <CardContent>
        {deadlines.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No upcoming deadlines.
          </p>
        ) : (
          <div className="space-y-3">
            {deadlines.map((d, i) => {
              const days = daysUntil(d.dueDate);
              const urgency =
                days < 0
                  ? "text-red-600"
                  : days <= 7
                    ? "text-amber-600"
                    : "text-muted-foreground";
              return (
                <div key={i} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${
                        typeColors[d.type] || "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {d.type.replace("_", " ")}
                    </span>
                    <span className="text-sm truncate">{d.description}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {new Date(d.dueDate).toLocaleDateString("en-NZ", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                    <span className={`text-xs font-medium ${urgency}`}>
                      {days < 0
                        ? `${Math.abs(days)}d overdue`
                        : days === 0
                          ? "Today"
                          : `${days}d`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
