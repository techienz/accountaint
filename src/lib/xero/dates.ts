/**
 * Parse Xero date strings.
 * Xero returns dates in Microsoft JSON format: "/Date(1234567890000+0000)/"
 * or sometimes as ISO strings. This handles both.
 */
export function parseXeroDate(dateStr: string): Date {
  if (!dateStr) return new Date(NaN);

  // Microsoft JSON date format: /Date(milliseconds+timezone)/
  const match = dateStr.match(/\/Date\((\d+)([+-]\d{4})?\)\//);
  if (match) {
    return new Date(parseInt(match[1], 10));
  }

  // ISO string fallback
  return new Date(dateStr);
}
