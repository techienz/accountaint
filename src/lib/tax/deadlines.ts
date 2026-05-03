import type {
  EntityType,
  GstFilingPeriod,
  Gst2MonthlyCycle,
  ProvisionalTaxMethod,
  PayeFrequency,
} from "./rules/types";
import { getTaxYear, getNzTaxYear } from "./rules";
import { nextWorkingDay } from "./dates";

export type DeadlineInput = {
  entity_type: EntityType;
  balance_date: string; // MM-DD
  gst_registered: boolean;
  gst_filing_period?: GstFilingPeriod;
  /**
   * IRD-assigned 2-monthly cycle. Only meaningful when
   * gst_filing_period === "2monthly". Falls back to "A" with a warning
   * if unset (matches the pre-#160 hardcoded behaviour while flagging
   * the assumption).
   */
  gst_2monthly_cycle?: Gst2MonthlyCycle;
  has_employees: boolean;
  paye_frequency?: PayeFrequency;
  provisional_tax_method?: ProvisionalTaxMethod;
  incorporation_date?: string; // YYYY-MM-DD
  fbt_registered?: boolean;
  pays_contractors?: boolean;
  /**
   * True if linked to a registered NZ tax agent for the extension-of-time
   * scheme. Affects IR4/IR3 filing dates (7 July → 31 March) and
   * terminal tax payment dates (7 February → 7 April). Default false
   * (most self-filers using the app as their accountant). Issue #163.
   */
  tax_agent_linked?: boolean;
  /**
   * True if the business pays dividends to shareholders. Triggers RWT
   * deadline emission: IR15P monthly (20th of next month) and IR15S
   * annual reconciliation (31 May). Issue #165.
   */
  pays_dividends?: boolean;
  /**
   * True if a shareholder-employee draws salary from the business. ACC
   * Work Account levy is liable on those earnings even with no PAYE
   * staff. Issue #168.
   */
  has_shareholder_employee?: boolean;
  dateRange: { from: Date; to: Date };
};

export type DeadlineType =
  | "gst" | "provisional_tax" | "income_tax" | "paye"
  | "ir3" | "ir4" | "ir6" | "ir7"
  | "imputation_return"          // IR4J — companies, alongside IR4 (#166)
  | "rwt_dividend_payment"       // IR15P — monthly when dividends paid (#165)
  | "rwt_annual_reconciliation"  // IR15S — annual, 31 May (#165)
  | "annual_return" | "acc_levy" | "fbt" | "schedular_payment";

export type Deadline = {
  type: DeadlineType;
  description: string;
  dueDate: string; // YYYY-MM-DD
  taxYear: number;
};

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function makeWorkingDate(year: number, month: number, day: number): Date {
  // month is 1-indexed here
  const date = new Date(year, month - 1, day);
  return nextWorkingDay(date);
}

function isInRange(date: Date, from: Date, to: Date): boolean {
  return date >= from && date <= to;
}

function parseBalanceDate(balanceDate: string): { month: number; day: number } {
  const [mm, dd] = balanceDate.split("-").map(Number);
  return { month: mm, day: dd };
}

/**
 * Get the GST due date for a given period-end month.
 * Two IRD exceptions:
 *  - Period ending 31 March → due 7 May (not 28 April)
 *  - Period ending 30 November → due 15 January (not 28 December)
 * All other periods → due 28th of the month after the period end.
 */
function getGstDueDate(periodEndMonth: number, periodEndYear: number): Date {
  if (periodEndMonth === 3) {
    // March period → due 7 May
    return makeWorkingDate(periodEndYear, 5, 7);
  }
  if (periodEndMonth === 11) {
    // November period → due 15 January next year
    return makeWorkingDate(periodEndYear + 1, 1, 15);
  }
  // Standard: 28th of the following month
  let dueMonth = periodEndMonth + 1;
  let dueYear = periodEndYear;
  if (dueMonth > 12) {
    dueMonth = 1;
    dueYear += 1;
  }
  return makeWorkingDate(dueYear, dueMonth, 28);
}

export function calculateDeadlines(config: DeadlineInput): Deadline[] {
  const deadlines: Deadline[] = [];
  const { from, to } = config.dateRange;

  const startTaxYear = getNzTaxYear(from);
  const endTaxYear = getNzTaxYear(to);

  // GST deadlines
  if (config.gst_registered && config.gst_filing_period) {
    deadlines.push(...calculateGstDeadlines(config, from, to));
  }

  // Provisional tax deadlines
  if (config.provisional_tax_method) {
    for (let ty = startTaxYear; ty <= endTaxYear; ty++) {
      deadlines.push(
        ...calculateProvisionalTaxDeadlines(config, ty, from, to)
      );
    }
  }

  // Income tax (terminal tax PAYMENT) deadlines
  for (let ty = startTaxYear - 1; ty <= endTaxYear; ty++) {
    deadlines.push(...calculateTerminalTaxDeadlines(config, ty, from, to));
  }

  // Income tax RETURN FILING deadlines (IR3 / IR4 / IR6 / IR7).
  // Distinct from terminal tax payment — the form filing has its own
  // deadline (7 July or 31 March with extension), separate from when the
  // money is due (7 February or 7 April with extension). Issue #163.
  for (let ty = startTaxYear - 1; ty <= endTaxYear; ty++) {
    deadlines.push(...calculateIncomeTaxFilingDeadlines(config, ty, from, to));
  }

  // IR4J Imputation Credit Account return — companies only, same date
  // as IR4 filing. Issue #166.
  if (config.entity_type === "company") {
    for (let ty = startTaxYear - 1; ty <= endTaxYear; ty++) {
      deadlines.push(...calculateImputationReturnDeadlines(config, ty, from, to));
    }
  }

  // RWT on dividends: IR15P (monthly, 20th of next month) + IR15S
  // (annual, 31 May). Only when the business pays dividends. Issue #165.
  if (config.pays_dividends) {
    deadlines.push(...calculateRwtDeadlines(from, to));
  }

  // PAYE deadlines
  if (config.has_employees && config.paye_frequency) {
    deadlines.push(...calculatePayeDeadlines(config, from, to));
  }

  // Annual return (companies only)
  deadlines.push(...calculateAnnualReturnDeadlines(config, from, to));

  // ACC Work Account levy — only payers (employers, sole traders, OR
  // companies with a shareholder-employee drawing salary). Issue #168.
  deadlines.push(...calculateAccLevyDeadlines(config, from, to));

  // FBT deadlines
  if (config.fbt_registered) {
    deadlines.push(...calculateFbtDeadlines(from, to));
  }

  // Schedular payment deadlines
  if (config.pays_contractors) {
    deadlines.push(...calculateSchedularPaymentDeadlines(config, from, to));
  }

  deadlines.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return deadlines;
}

function calculateGstDeadlines(
  config: DeadlineInput,
  from: Date,
  to: Date
): Deadline[] {
  const deadlines: Deadline[] = [];
  const period = config.gst_filing_period!;
  const balanceMonth = parseBalanceDate(config.balance_date).month;

  // Determine GST period end months based on filing period and balance date
  let periodEndMonths: number[];
  if (period === "monthly") {
    periodEndMonths = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  } else if (period === "2monthly") {
    // NZ has two 2-monthly cycles assigned by IRD (#160):
    //   "A" — period ends Jan/Mar/May/Jul/Sep/Nov
    //   "B" — period ends Feb/Apr/Jun/Aug/Oct/Dec
    // Default to "A" when unset to preserve pre-#160 behaviour. The
    // settings UI surfaces a warning when the cycle is unconfigured so
    // users on Cycle B can correct it. Tracking: #160.
    periodEndMonths =
      config.gst_2monthly_cycle === "B"
        ? [2, 4, 6, 8, 10, 12]
        : [1, 3, 5, 7, 9, 11];
  } else {
    // 6-monthly: periods end at balance month and 6 months before
    // e.g. March balance → periods end Mar & Sep
    // e.g. June balance → periods end Jun & Dec
    const secondPeriod = balanceMonth <= 6 ? balanceMonth + 6 : balanceMonth - 6;
    periodEndMonths = [balanceMonth, secondPeriod].sort((a, b) => a - b);
  }

  const periodNames: Record<GstFilingPeriod, string> = {
    monthly: "monthly",
    "2monthly": "two-monthly",
    "6monthly": "six-monthly",
  };

  const startYear = from.getFullYear();
  const endYear = to.getFullYear();

  for (let year = startYear; year <= endYear + 1; year++) {
    for (const periodEndMonth of periodEndMonths) {
      const dueDate = getGstDueDate(periodEndMonth, year);

      if (isInRange(dueDate, from, to)) {
        let periodDesc: string;
        if (period === "monthly") {
          periodDesc = `${MONTH_NAMES[periodEndMonth - 1]} ${year}`;
        } else if (period === "2monthly") {
          const prevMonth = periodEndMonth - 1 <= 0 ? 12 : periodEndMonth - 1;
          periodDesc = `${MONTH_NAMES[prevMonth - 1]}-${MONTH_NAMES[periodEndMonth - 1]} ${year}`;
        } else {
          const startMonth = periodEndMonth - 5;
          if (startMonth > 0) {
            periodDesc = `${MONTH_NAMES[startMonth - 1]}-${MONTH_NAMES[periodEndMonth - 1]} ${year}`;
          } else {
            const adjMonth = startMonth + 12;
            periodDesc = `${MONTH_NAMES[adjMonth - 1]} ${year - 1}-${MONTH_NAMES[periodEndMonth - 1]} ${year}`;
          }
        }

        deadlines.push({
          type: "gst",
          description: `GST return (${periodNames[period]}) for ${periodDesc}`,
          dueDate: formatDate(dueDate),
          taxYear: getNzTaxYear(dueDate),
        });
      }
    }
  }

  return deadlines;
}

function calculateProvisionalTaxDeadlines(
  config: DeadlineInput,
  taxYear: number,
  from: Date,
  to: Date
): Deadline[] {
  const deadlines: Deadline[] = [];
  const taxConfig = getTaxYear(new Date(taxYear, 0, 1));
  if (!taxConfig) return deadlines;

  const method = config.provisional_tax_method!;
  const dates =
    method === "aim"
      ? taxConfig.provisionalTaxDates.aim
      : taxConfig.provisionalTaxDates.standard;

  const balanceMonth = parseBalanceDate(config.balance_date).month;

  dates.forEach((mmdd, index) => {
    const [mm, dd] = mmdd.split("-").map(Number);

    // Determine the calendar year for this instalment.
    // For March balance date: tax year 2026 runs Apr 2025 - Mar 2026.
    let calendarYear: number;
    if (mm >= balanceMonth + 1) {
      calendarYear = taxYear - 1;
    } else {
      calendarYear = taxYear;
    }

    // Special case: dates just after balance date (e.g. May 7 for March balance)
    // are still part of the same tax year's provisional obligations
    if (mm > balanceMonth && mm <= balanceMonth + 2) {
      calendarYear = taxYear;
    }

    const dueDate = makeWorkingDate(calendarYear, mm, dd);

    if (isInRange(dueDate, from, to)) {
      const label =
        method === "aim"
          ? `AIM provisional tax instalment ${index + 1}`
          : `Provisional tax instalment ${index + 1} of 3`;

      deadlines.push({
        type: "provisional_tax",
        description: `${label} (${taxYear} tax year)`,
        dueDate: formatDate(dueDate),
        taxYear,
      });
    }
  });

  return deadlines;
}

function calculateTerminalTaxDeadlines(
  config: DeadlineInput,
  taxYear: number,
  from: Date,
  to: Date
): Deadline[] {
  const deadlines: Deadline[] = [];
  const taxConfig = getTaxYear(new Date(taxYear, 0, 1));
  if (!taxConfig) return deadlines;

  const { month: balMonth } = parseBalanceDate(config.balance_date);

  // NZ terminal tax is due:
  //   - 7th day, 11 months after the balance date  (no tax-agent extension)
  //   - 7 April of (taxYear + 1) for March balance  (with tax-agent extension)
  // For March (month 3) balance date, tax year 2026:
  //   no extension: 3 + 11 = 14 -> month 2 of next year = 7 February 2027.
  //   extension:    7 April 2027.
  // The extension shifts the date by 2 months for ALL balance dates.
  // Issue #163.
  let terminalMonth = balMonth + 11;
  let terminalYear = taxYear;
  if (terminalMonth > 12) {
    terminalMonth -= 12;
    terminalYear += 1;
  }

  if (config.tax_agent_linked) {
    terminalMonth += 2;
    if (terminalMonth > 12) {
      terminalMonth -= 12;
      terminalYear += 1;
    }
  }

  const dueDate = makeWorkingDate(terminalYear, terminalMonth, 7);

  if (isInRange(dueDate, from, to)) {
    deadlines.push({
      type: "income_tax",
      description: `Income tax (terminal tax payment) for ${taxYear} tax year${
        config.tax_agent_linked ? " — tax agent extension" : ""
      }`,
      dueDate: formatDate(dueDate),
      taxYear,
    });
  }

  return deadlines;
}

/**
 * Income tax RETURN filing deadlines (IR3 / IR4 / IR6 / IR7) — distinct
 * from the terminal tax PAYMENT date.
 *
 * Without tax-agent extension: filing due 7 July of (taxYear + 1) for
 * a March-balance entity (and 7 of the 4th month after balance for
 * other balance dates).
 *
 * With tax-agent extension: filing due 31 March of (taxYear + 2) for
 * a March-balance entity. The extension defers the form filing by
 * approximately 9 months while only deferring the payment by 2 months.
 *
 * Issue #163.
 */
function calculateIncomeTaxFilingDeadlines(
  config: DeadlineInput,
  taxYear: number,
  from: Date,
  to: Date
): Deadline[] {
  const deadlines: Deadline[] = [];
  const { month: balMonth } = parseBalanceDate(config.balance_date);

  // Pick form by entity type.
  const formByEntity: Record<EntityType, "ir3" | "ir4" | "ir6" | "ir7"> = {
    company: "ir4",
    sole_trader: "ir3",
    trust: "ir6",
    partnership: "ir7",
  };
  const formType = formByEntity[config.entity_type];
  const formLabel = formType.toUpperCase();

  // Standard filing date: 7 of the month 4 months after balance month,
  // in the calendar year of the balance date. For March balance (3),
  // filingMonth = 7 (July) and filingYear = taxYear (e.g. 7 July 2026
  // for tax year 2026 ending 31 March 2026). For December balance (12),
  // filingMonth = 16 → 4 (April) of (taxYear + 1).
  let standardFilingMonth = balMonth + 4;
  let standardFilingYear = taxYear;
  if (standardFilingMonth > 12) {
    standardFilingMonth -= 12;
    standardFilingYear += 1;
  }

  // With tax-agent extension: 31 March of the income year following the
  // year of the standard due date. For March balance: standard July
  // 2026 → extension 31 March 2027. For December balance: standard
  // April 2027 → extension 31 March 2028.
  const dueDate = config.tax_agent_linked
    ? makeWorkingDate(standardFilingYear + 1, 3, 31)
    : makeWorkingDate(standardFilingYear, standardFilingMonth, 7);
  const descriptionSuffix = config.tax_agent_linked ? " — tax agent extension" : "";

  if (isInRange(dueDate, from, to)) {
    deadlines.push({
      type: formType,
      description: `${formLabel} income tax return for ${taxYear} tax year${descriptionSuffix}`,
      dueDate: formatDate(dueDate),
      taxYear,
    });
  }

  return deadlines;
}

function calculatePayeDeadlines(
  config: DeadlineInput,
  from: Date,
  to: Date
): Deadline[] {
  const deadlines: Deadline[] = [];
  const frequency = config.paye_frequency!;

  const startYear = from.getFullYear();
  const endYear = to.getFullYear();

  for (let year = startYear; year <= endYear + 1; year++) {
    for (let month = 1; month <= 12; month++) {
      if (frequency === "monthly") {
        // Due 20th of the following month
        let dueMonth = month + 1;
        let dueYear = year;
        if (dueMonth > 12) {
          dueMonth = 1;
          dueYear = year + 1;
        }
        const dueDate = makeWorkingDate(dueYear, dueMonth, 20);
        if (isInRange(dueDate, from, to)) {
          deadlines.push({
            type: "paye",
            description: `PAYE for ${MONTH_NAMES[month - 1]} ${year}`,
            dueDate: formatDate(dueDate),
            taxYear: getNzTaxYear(dueDate),
          });
        }
      } else {
        // Twice-monthly PAYE (IRD rules):
        //   Pay period 1st-15th → due 20th of the SAME month
        //   Pay period 16th-end → due 5th of the FOLLOWING month

        // 1st-15th pay period → due 20th of same month
        const due20th = makeWorkingDate(year, month, 20);
        if (isInRange(due20th, from, to)) {
          deadlines.push({
            type: "paye",
            description: `PAYE (1st-15th ${MONTH_NAMES[month - 1]} ${year})`,
            dueDate: formatDate(due20th),
            taxYear: getNzTaxYear(due20th),
          });
        }

        // 16th-end pay period → due 5th of next month
        let nextMonth = month + 1;
        let nextYear = year;
        if (nextMonth > 12) {
          nextMonth = 1;
          nextYear = year + 1;
        }
        const due5th = makeWorkingDate(nextYear, nextMonth, 5);
        if (isInRange(due5th, from, to)) {
          deadlines.push({
            type: "paye",
            description: `PAYE (16th-end ${MONTH_NAMES[month - 1]} ${year})`,
            dueDate: formatDate(due5th),
            taxYear: getNzTaxYear(due5th),
          });
        }
      }
    }
  }

  return deadlines;
}

function calculateAnnualReturnDeadlines(
  config: DeadlineInput,
  from: Date,
  to: Date
): Deadline[] {
  if (config.entity_type !== "company" || !config.incorporation_date) return [];

  const deadlines: Deadline[] = [];
  const incMonth = parseInt(config.incorporation_date.slice(5, 7), 10);

  const startYear = from.getFullYear();
  const endYear = to.getFullYear();

  for (let year = startYear; year <= endYear; year++) {
    const lastDay = new Date(year, incMonth, 0).getDate();
    const dueDate = new Date(year, incMonth - 1, lastDay);

    if (isInRange(dueDate, from, to)) {
      deadlines.push({
        type: "annual_return",
        description: `Companies Office annual return`,
        dueDate: formatDate(dueDate),
        taxYear: getNzTaxYear(dueDate),
      });
    }
  }

  return deadlines;
}

/**
 * ACC Work Account levy. Per ACC's published guidance:
 *   - Employers are invoiced ~July, due 30 days later (~early August)
 *   - Sole traders / shareholder-employees are invoiced ~September,
 *     due 30 days later (~early October)
 *
 * Sole-director companies with NO shareholder-employee and NO PAYE
 * staff don't get a Work Account levy at all (the director's earner
 * levy is collected through PAYE if they're paid as such; otherwise
 * via IR3 if they take dividends only).
 *
 * Issue #168.
 */
function calculateAccLevyDeadlines(
  config: DeadlineInput,
  from: Date,
  to: Date
): Deadline[] {
  const deadlines: Deadline[] = [];
  const startYear = from.getFullYear();
  const endYear = to.getFullYear();

  // Determine payer type. Skip emission entirely if the business has
  // no liable earners.
  const isEmployer = config.has_employees;
  const isSelfEmployedLike =
    config.entity_type === "sole_trader" || config.has_shareholder_employee;

  if (!isEmployer && !isSelfEmployedLike) {
    return deadlines;
  }

  // Pick the timing that applies. If both apply (rare: company with
  // PAYE staff AND a shareholder-employee), prefer the employer cadence
  // since the levy bill is mostly driven by Employer Monthly Schedule
  // earnings.
  const dueMonth = isEmployer ? 7 /* August (next-month) */ : 9 /* October */;
  const description = isEmployer
    ? "ACC Work Account levy (employer) — due ~30 days from July invoice"
    : "ACC Work Account levy (self-employed / shareholder-employee) — due ~30 days from September invoice";

  for (let year = startYear; year <= endYear; year++) {
    // Approximate due date — actual date is 30 days from invoice issue
    // and varies. Use day 7 of the month after invoicing as a sensible
    // default. Users can confirm against their actual invoice once
    // received.
    const dueDate = new Date(year, dueMonth, 7);
    if (isInRange(dueDate, from, to)) {
      deadlines.push({
        type: "acc_levy",
        description,
        dueDate: formatDate(dueDate),
        taxYear: getNzTaxYear(dueDate),
      });
    }
  }

  return deadlines;
}

/**
 * IR4J Imputation Credit Account return — filed alongside the company's
 * IR4 income tax return. Same due date as IR4 (7 July without tax-agent
 * extension, 31 March with). Issue #166.
 *
 * Source: IRD imputation page confirms IR4J is filed as part of the
 * company income tax return. Specific IR4J due date isn't published on
 * IRD HTML pages — bundled-with-IR4 inferred from "filed as part of".
 */
function calculateImputationReturnDeadlines(
  config: DeadlineInput,
  taxYear: number,
  from: Date,
  to: Date
): Deadline[] {
  const deadlines: Deadline[] = [];
  if (config.entity_type !== "company") return deadlines;

  const { month: balMonth } = parseBalanceDate(config.balance_date);

  // Same date logic as the IR4 filing (calculateIncomeTaxFilingDeadlines).
  let standardFilingMonth = balMonth + 4;
  let standardFilingYear = taxYear;
  if (standardFilingMonth > 12) {
    standardFilingMonth -= 12;
    standardFilingYear += 1;
  }

  const dueDate = config.tax_agent_linked
    ? makeWorkingDate(standardFilingYear + 1, 3, 31)
    : makeWorkingDate(standardFilingYear, standardFilingMonth, 7);
  const descriptionSuffix = config.tax_agent_linked ? " — tax agent extension" : "";

  if (isInRange(dueDate, from, to)) {
    deadlines.push({
      type: "imputation_return",
      description: `IR4J Imputation Credit Account return for ${taxYear} tax year${descriptionSuffix}`,
      dueDate: formatDate(dueDate),
      taxYear,
    });
  }

  return deadlines;
}

/**
 * RWT on dividends — emitted when the business pays dividends. Per
 * NZ withholding-tax convention (canonical source: IR284 PDF, not on
 * public IRD HTML):
 *
 *   - IR15P: monthly RWT payment, due 20th of the month following any
 *     month a dividend was paid. Emit a recurring monthly placeholder
 *     so the user is reminded to file IF they paid a dividend that
 *     month — actual filing is event-driven.
 *   - IR15S: annual reconciliation, due 31 May for the tax year ending
 *     31 March.
 *
 * Issue #165. TODO: cite IR284 section/page in code comment once PDF
 * has been cross-checked.
 */
function calculateRwtDeadlines(from: Date, to: Date): Deadline[] {
  const deadlines: Deadline[] = [];
  const startYear = from.getFullYear();
  const endYear = to.getFullYear() + 1;

  // Monthly IR15P: 20th of every month within the date range.
  for (let year = startYear; year <= endYear; year++) {
    for (let month = 1; month <= 12; month++) {
      const dueDate = makeWorkingDate(year, month, 20);
      if (isInRange(dueDate, from, to)) {
        // Reference the previous month — payment due 20th of THIS month
        // covers dividends paid in the PREVIOUS month.
        const prevMonth = month === 1 ? 12 : month - 1;
        const prevYear = month === 1 ? year - 1 : year;
        deadlines.push({
          type: "rwt_dividend_payment",
          description: `RWT on dividends (IR15P) — pay any RWT withheld on dividends paid in ${MONTH_NAMES[prevMonth - 1]} ${prevYear}`,
          dueDate: formatDate(dueDate),
          taxYear: getNzTaxYear(dueDate),
        });
      }
    }
  }

  // Annual IR15S: 31 May for tax year ending 31 March (year+1).
  for (let year = startYear; year <= endYear; year++) {
    const dueDate = makeWorkingDate(year, 5, 31);
    if (isInRange(dueDate, from, to)) {
      // Tax year for an IR15S filed 31 May YYYY covers the period ending
      // 31 March YYYY.
      const reconciledTaxYear = year;
      deadlines.push({
        type: "rwt_annual_reconciliation",
        description: `RWT annual reconciliation (IR15S) for ${reconciledTaxYear} tax year`,
        dueDate: formatDate(dueDate),
        taxYear: reconciledTaxYear,
      });
    }
  }

  return deadlines;
}

function calculateFbtDeadlines(
  from: Date,
  to: Date
): Deadline[] {
  const deadlines: Deadline[] = [];
  const startYear = from.getFullYear();
  const endYear = to.getFullYear();

  for (let year = startYear; year <= endYear; year++) {
    const quarters = [
      { date: makeWorkingDate(year, 7, 20), desc: `FBT return Q1 (Apr\u2013Jun ${year})` },
      { date: makeWorkingDate(year, 10, 20), desc: `FBT return Q2 (Jul\u2013Sep ${year})` },
      { date: makeWorkingDate(year + 1, 1, 20), desc: `FBT return Q3 (Oct\u2013Dec ${year})` },
      { date: makeWorkingDate(year, 5, 31), desc: `FBT return Q4 (Jan\u2013Mar ${year})` },
    ];

    for (const q of quarters) {
      if (isInRange(q.date, from, to)) {
        deadlines.push({
          type: "fbt",
          description: q.desc,
          dueDate: formatDate(q.date),
          taxYear: getNzTaxYear(q.date),
        });
      }
    }
  }

  return deadlines;
}

function calculateSchedularPaymentDeadlines(
  config: DeadlineInput,
  from: Date,
  to: Date
): Deadline[] {
  const frequency = config.paye_frequency || "monthly";
  const deadlines: Deadline[] = [];

  const startYear = from.getFullYear();
  const endYear = to.getFullYear();

  for (let year = startYear; year <= endYear + 1; year++) {
    for (let month = 1; month <= 12; month++) {
      if (frequency === "monthly") {
        let dueMonth = month + 1;
        let dueYear = year;
        if (dueMonth > 12) { dueMonth = 1; dueYear = year + 1; }
        const dueDate = makeWorkingDate(dueYear, dueMonth, 20);
        if (isInRange(dueDate, from, to)) {
          deadlines.push({
            type: "schedular_payment",
            description: `Schedular payment withholding (${MONTH_NAMES[month - 1]} ${year})`,
            dueDate: formatDate(dueDate),
            taxYear: getNzTaxYear(dueDate),
          });
        }
      } else {
        const due20th = makeWorkingDate(year, month, 20);
        if (isInRange(due20th, from, to)) {
          deadlines.push({
            type: "schedular_payment",
            description: `Schedular payment withholding (1\u201315 ${MONTH_NAMES[month - 1]})`,
            dueDate: formatDate(due20th),
            taxYear: getNzTaxYear(due20th),
          });
        }
        let nextMonth = month + 1;
        let nextYear = year;
        if (nextMonth > 12) { nextMonth = 1; nextYear = year + 1; }
        const due5th = makeWorkingDate(nextYear, nextMonth, 5);
        if (isInRange(due5th, from, to)) {
          deadlines.push({
            type: "schedular_payment",
            description: `Schedular payment withholding (16\u2013${new Date(year, month, 0).getDate()} ${MONTH_NAMES[month - 1]})`,
            dueDate: formatDate(due5th),
            taxYear: getNzTaxYear(due5th),
          });
        }
      }
    }
  }

  return deadlines;
}
