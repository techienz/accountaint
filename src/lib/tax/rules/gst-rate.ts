import { getTaxYearConfig, getNzTaxYear } from "./index";

/**
 * The standard NZ GST rate that applies on a given date. Centralises the
 * fallback that used to live as a literal `0.15` scattered across invoice,
 * ledger, and chat-tool code (audit #117). When NZ next changes the rate,
 * only the per-year rules table needs updating.
 *
 * Pass a date if you have one (line items have an invoice date; journal
 * entries have a posting date). Omit to use today's tax year — fine for
 * defaults set at form-render time.
 *
 * Note: line items can override per-row (zero-rated items, exports). This
 * helper is only the default applied when no per-line rate is supplied.
 */
export function getStandardGstRate(date?: Date | string): number {
  const d = date ? (typeof date === "string" ? new Date(date) : date) : new Date();
  return getTaxYearConfig(getNzTaxYear(d)).gstRate;
}
