/**
 * Format a YYYY-MM-DD date string as DD-MM-YYYY (NZ convention).
 * Returns the input unchanged if it doesn't match the expected pattern.
 */
export function formatDateNzDash(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return dateStr;
  return `${m[3]}-${m[2]}-${m[1]}`;
}
