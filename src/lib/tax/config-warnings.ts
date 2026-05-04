/**
 * Wrong-by-default config detection.
 *
 * Several fields on the businesses table affect deadline emission. When
 * a parent flag is set (e.g. gst_registered=true) but a required child
 * field is null (e.g. gst_filing_period), the deadline calculator
 * silently emits nothing or falls back to a default — and the user
 * never knows their reminders are missing or wrong.
 *
 * This helper inspects a business config and returns user-facing
 * warnings the dashboard / deadlines page can render. Each warning has
 * a short title, a longer explanation, and a deep-link to the settings
 * field that fixes it.
 *
 * Issue #170.
 */

export type ConfigWarning = {
  /** Short stable id, useful for deduplication / tests */
  id: string;
  /** What's wrong, in 5-10 words */
  title: string;
  /** Why it matters and what's missing as a result */
  message: string;
  /** Deep link to the settings page where the fix lives */
  fixHref: string;
  /** Severity hint for UI styling */
  severity: "warning" | "error";
};

/**
 * Subset of the businesses-row shape that's relevant here. Kept minimal
 * so callers don't have to provide the entire row.
 */
export type WarnableBusinessConfig = {
  entity_type: string;
  gst_registered: boolean;
  gst_filing_period?: string | null;
  gst_2monthly_cycle?: string | null;
  has_employees: boolean;
  paye_frequency?: string | null;
  provisional_tax_method?: string | null;
  incorporation_date?: string | null;
  companies_office_annual_return_month?: number | null;
  pays_dividends?: boolean | null;
  has_shareholder_employee?: boolean | null;
};

export function detectConfigWarnings(
  config: WarnableBusinessConfig
): ConfigWarning[] {
  const warnings: ConfigWarning[] = [];

  // GST registered without a filing period → no GST deadlines emitted.
  if (config.gst_registered && !config.gst_filing_period) {
    warnings.push({
      id: "gst_registered_no_period",
      title: "GST filing period not set",
      message:
        "You're marked GST-registered but no filing period is selected. Without it, no GST deadlines will appear in your reminders.",
      fixHref: "/settings",
      severity: "error",
    });
  }

  // GST 2-monthly without cycle A/B → falls back to A. Surface as warning.
  if (
    config.gst_registered &&
    config.gst_filing_period === "2monthly" &&
    !config.gst_2monthly_cycle
  ) {
    warnings.push({
      id: "gst_2monthly_no_cycle",
      title: "GST 2-monthly cycle not set",
      message:
        "You're on the 2-monthly GST cycle but haven't picked Cycle A or B. The deadline calculator is assuming Cycle A — set this to match your IRD assignment for correct dates.",
      fixHref: "/settings",
      severity: "warning",
    });
  }

  // Has employees but no PAYE frequency → PAYE branch defaults to monthly.
  if (config.has_employees && !config.paye_frequency) {
    warnings.push({
      id: "employees_no_paye_frequency",
      title: "PAYE filing frequency not set",
      message:
        "You have employees but haven't picked a PAYE filing frequency (monthly or twice-monthly). The deadline calculator is defaulting to monthly — confirm or change in business settings.",
      fixHref: "/settings",
      severity: "warning",
    });
  }

  // No provisional tax method → no provisional tax deadlines.
  if (!config.provisional_tax_method) {
    warnings.push({
      id: "no_provisional_tax_method",
      title: "Provisional tax method not set",
      message:
        "Most NZ businesses earning over $5,000 of residual income tax must use a provisional-tax method (Standard, Estimation, or AIM). Without selecting one, no provisional-tax deadlines will appear.",
      fixHref: "/settings",
      severity: "warning",
    });
  }

  // Company without incorporation date AND without a registrar-assigned
  // annual-return month → no annual returns will appear.
  if (
    config.entity_type === "company" &&
    !config.incorporation_date &&
    !config.companies_office_annual_return_month
  ) {
    warnings.push({
      id: "company_no_annual_return_month",
      title: "Companies Office annual-return month not set",
      message:
        "Your company has no incorporation date AND no Companies Office annual-return month set. Without one, no Companies Office annual return reminders will appear.",
      fixHref: "/settings",
      severity: "error",
    });
  }

  return warnings;
}
