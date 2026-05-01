/**
 * Builds the {{overdue_phrase}} variable used by the invoice_reminder
 * template. Pure so the wording can be unit-tested without standing up
 * the database / email pipeline.
 *
 * Rules:
 *   - dueDate AFTER today  -> "is due on DD-MM-YYYY"  (early reminder)
 *   - dueDate ON today     -> "is due today"
 *   - dueDate BEFORE today -> "is now N days overdue (was due DD-MM-YYYY)"
 *
 * Day count uses calendar days (UTC midnights) so timezone drift around
 * midnight doesn't shift the number by one.
 */
export function buildOverduePhrase(dueDate: string, today: Date): string {
  const due = parseIsoDate(dueDate);
  if (!due) return `was due ${formatDdMmYyyy(dueDate)}`;

  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const dueUtc = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  const days = Math.round((todayUtc - dueUtc) / (24 * 60 * 60 * 1000));

  if (days === 0) return "is due today";
  if (days < 0) return `is due on ${formatDdMmYyyy(dueDate)}`;
  return `is now ${days} day${days === 1 ? "" : "s"} overdue (was due ${formatDdMmYyyy(dueDate)})`;
}

function parseIsoDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const [, y, mo, d] = m;
  const dt = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function formatDdMmYyyy(s: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return s;
  return `${m[3]}-${m[2]}-${m[1]}`;
}
