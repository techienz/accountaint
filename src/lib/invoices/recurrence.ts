/**
 * Pure date arithmetic for advancing a recurring-invoice schedule's
 * next_run_date. Extracted from the library so it's unit-testable
 * without standing up a database.
 *
 * Frequencies:
 *   - weekly       → +7 days
 *   - fortnightly  → +14 days
 *   - monthly      → same day of next calendar month, clamping to the
 *                    last day of the month if the original day overflows
 *                    (e.g. Jan 31 → Feb 28; Feb 29 → Mar 29 next year)
 *   - quarterly    → same as monthly but +3 months
 *
 * Always works on UTC midnights so timezone DST does not skew the result.
 */
export type RecurrenceFrequency = "weekly" | "fortnightly" | "monthly" | "quarterly";

export function nextRunDate(
  current: string,
  frequency: RecurrenceFrequency,
): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(current);
  if (!m) throw new Error(`Invalid date string: ${current}`);
  const year = Number(m[1]);
  const month = Number(m[2]); // 1-12
  const day = Number(m[3]);

  if (frequency === "weekly" || frequency === "fortnightly") {
    const days = frequency === "weekly" ? 7 : 14;
    const utc = Date.UTC(year, month - 1, day);
    const next = new Date(utc + days * 24 * 60 * 60 * 1000);
    return formatIso(next);
  }

  const monthStep = frequency === "monthly" ? 1 : 3;
  // Add monthStep, then clamp the day to the new month's max
  let nextMonth = month + monthStep; // 1-15
  let nextYear = year;
  while (nextMonth > 12) {
    nextMonth -= 12;
    nextYear += 1;
  }
  const lastDay = daysInMonth(nextYear, nextMonth);
  const clampedDay = Math.min(day, lastDay);
  return `${nextYear}-${pad(nextMonth)}-${pad(clampedDay)}`;
}

function daysInMonth(year: number, month: number): number {
  // month is 1-12. Day 0 of next month = last day of this month.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function formatIso(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
