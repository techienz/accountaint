import type {
  EntityType,
  GstFilingPeriod,
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
  has_employees: boolean;
  paye_frequency?: PayeFrequency;
  provisional_tax_method?: ProvisionalTaxMethod;
  incorporation_date?: string; // YYYY-MM-DD
  fbt_registered?: boolean;
  pays_contractors?: boolean;
  dateRange: { from: Date; to: Date };
};

export type DeadlineType =
  | "gst" | "provisional_tax" | "income_tax" | "paye"
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

  // Income tax (terminal tax) deadlines
  for (let ty = startTaxYear - 1; ty <= endTaxYear; ty++) {
    deadlines.push(...calculateTerminalTaxDeadlines(config, ty, from, to));
  }

  // PAYE deadlines
  if (config.has_employees && config.paye_frequency) {
    deadlines.push(...calculatePayeDeadlines(config, from, to));
  }

  // Annual return (companies only)
  deadlines.push(...calculateAnnualReturnDeadlines(config, from, to));

  // ACC levy (all businesses)
  deadlines.push(...calculateAccLevyDeadlines(from, to));

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
    // Standard 2-monthly periods: Jan, Mar, May, Jul, Sep, Nov
    periodEndMonths = [1, 3, 5, 7, 9, 11];
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

  // NZ terminal tax is due on the 7th day, 11 months after the balance date.
  // For March (month 3) balance date, tax year 2026:
  //   3 + 11 = 14 -> month 2 of next year = 7 February 2027.
  let terminalMonth = balMonth + 11;
  let terminalYear = taxYear;
  if (terminalMonth > 12) {
    terminalMonth -= 12;
    terminalYear += 1;
  }

  const dueDate = makeWorkingDate(terminalYear, terminalMonth, 7);

  if (isInRange(dueDate, from, to)) {
    deadlines.push({
      type: "income_tax",
      description: `Income tax (terminal tax) for ${taxYear} tax year`,
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

function calculateAccLevyDeadlines(
  from: Date,
  to: Date
): Deadline[] {
  const deadlines: Deadline[] = [];
  const startYear = from.getFullYear();
  const endYear = to.getFullYear();

  for (let year = startYear; year <= endYear; year++) {
    const dueDate = new Date(year, 8, 30); // September 30
    if (isInRange(dueDate, from, to)) {
      deadlines.push({
        type: "acc_levy",
        description: `ACC levy payment due`,
        dueDate: formatDate(dueDate),
        taxYear: getNzTaxYear(dueDate),
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
