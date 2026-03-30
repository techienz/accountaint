import type { Change } from "@/lib/crosscheck/diff";

type ChangeReport = {
  id: string;
  entity_type: string;
  change_count: number;
  created_at: Date;
  changes: Change[];
};

const entityLabels: Record<string, string> = {
  profit_loss: "Profit & Loss",
  balance_sheet: "Balance Sheet",
  bank_accounts: "Bank Accounts",
  invoices: "Invoices",
  contacts: "Contacts",
};

const changeTypeStyles: Record<string, string> = {
  added: "text-green-700 dark:text-green-400",
  removed: "text-red-700 dark:text-red-400",
  modified: "text-amber-700 dark:text-amber-400",
};

export function ChangesTimeline({ reports }: { reports: ChangeReport[] }) {
  if (reports.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No changes detected recently. Changes will appear here after your next Xero sync.
      </p>
    );
  }

  // Group by date
  const grouped = new Map<string, ChangeReport[]>();
  for (const report of reports) {
    const dateKey = report.created_at.toISOString().slice(0, 10);
    const group = grouped.get(dateKey) || [];
    group.push(report);
    grouped.set(dateKey, group);
  }

  return (
    <div className="space-y-6">
      {[...grouped.entries()].map(([date, dateReports]) => (
        <div key={date}>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            {new Date(date).toLocaleDateString("en-NZ", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </h3>
          <div className="space-y-4">
            {dateReports.map((report) => (
              <div
                key={report.id}
                className="rounded-lg border p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">
                    {entityLabels[report.entity_type] || report.entity_type}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {report.change_count} {report.change_count === 1 ? "change" : "changes"}
                  </span>
                </div>
                <ul className="space-y-1">
                  {report.changes.slice(0, 10).map((change, idx) => (
                    <li key={idx} className="text-sm">
                      <span className={changeTypeStyles[change.type] || ""}>
                        {change.type === "added" ? "+" : change.type === "removed" ? "−" : "~"}
                      </span>{" "}
                      {change.description}
                    </li>
                  ))}
                  {report.changes.length > 10 && (
                    <li className="text-xs text-muted-foreground">
                      ...and {report.changes.length - 10} more
                    </li>
                  )}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
