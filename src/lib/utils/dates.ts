/**
 * NZ timezone-safe date utilities.
 *
 * The app runs in NZ (Pacific/Auckland, NZST UTC+12 / NZDT UTC+13).
 * Using toISOString().slice(0,10) converts to UTC which shifts dates
 * back a day in NZ afternoons/evenings. These helpers avoid that.
 */

const NZ_TIMEZONE = "Pacific/Auckland";

/**
 * Format a Date to YYYY-MM-DD in NZ timezone.
 * Safe replacement for `date.toISOString().slice(0, 10)`.
 */
export function formatDateNZ(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Get today's date as YYYY-MM-DD in NZ timezone.
 * Safe replacement for `new Date().toISOString().slice(0, 10)`.
 */
export function todayNZ(): string {
  return formatDateNZ(new Date());
}

/**
 * Parse a YYYY-MM-DD string as a local date (not UTC).
 * `new Date("2026-04-07")` parses as UTC midnight = wrong day in NZ.
 * This returns a Date at local midnight.
 */
export function parseDateLocal(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Format a YYYY-MM-DD string for display in NZ format (DD/MM/YYYY).
 */
export function formatDateDisplay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Format a Date for display in NZ locale with options.
 */
export function formatDateLocale(
  date: Date,
  options?: Intl.DateTimeFormatOptions
): string {
  return date.toLocaleDateString("en-NZ", {
    timeZone: NZ_TIMEZONE,
    ...options,
  });
}

/**
 * Format a Date for display with time in NZ locale.
 */
export function formatDateTimeLocale(
  date: Date,
  options?: Intl.DateTimeFormatOptions
): string {
  return date.toLocaleString("en-NZ", {
    timeZone: NZ_TIMEZONE,
    ...options,
  });
}

/**
 * Get the start of a date range (first of month) as YYYY-MM-DD.
 */
export function monthStartNZ(date: Date = new Date()): string {
  return formatDateNZ(new Date(date.getFullYear(), date.getMonth(), 1));
}

/**
 * Get the end of a month as YYYY-MM-DD.
 */
export function monthEndNZ(date: Date = new Date()): string {
  return formatDateNZ(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}
