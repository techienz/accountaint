import { getTaxYearConfig } from "./rules";
import { nextWorkingDay } from "./dates";
import type { ProvisionalTaxMethod } from "./rules/types";

export type ProvisionalInstalment = {
  number: number;
  dueDate: string;
  amountDue: number;
  amountPaid: number | null;
  paidDate: string | null;
};

export type ProvisionalTaxSchedule = {
  method: ProvisionalTaxMethod;
  taxYear: number;
  instalments: ProvisionalInstalment[];
  totalDue: number;
  totalPaid: number;
  balance: number;
};

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function calculateProvisionalTax(
  method: ProvisionalTaxMethod,
  taxYear: number,
  priorYearRIT: number,
  balanceDate: string
): ProvisionalTaxSchedule {
  const config = getTaxYearConfig(taxYear);
  const dates =
    method === "aim"
      ? config.provisionalTaxDates.aim
      : config.provisionalTaxDates.standard;

  const balMonth = parseInt(balanceDate.split("-")[0], 10);

  // Standard uplift: prior year RIT + 5%
  const totalDue =
    method === "estimation"
      ? priorYearRIT // estimation uses the provided amount directly
      : Math.round(priorYearRIT * 1.05 * 100) / 100;

  const instalmentCount = dates.length;
  const perInstalment = Math.round((totalDue / instalmentCount) * 100) / 100;

  const instalments: ProvisionalInstalment[] = dates.map((mmdd, index) => {
    const [mm, dd] = mmdd.split("-").map(Number);

    let calendarYear: number;
    if (mm >= balMonth + 1) {
      calendarYear = taxYear - 1;
    } else {
      calendarYear = taxYear;
    }
    // Dates just after balance date stay in current tax year
    if (mm > balMonth && mm <= balMonth + 2) {
      calendarYear = taxYear;
    }

    const rawDate = new Date(calendarYear, mm - 1, dd);
    const dueDate = nextWorkingDay(rawDate);

    // Last instalment absorbs rounding difference
    const amount =
      index === instalmentCount - 1
        ? Math.round((totalDue - perInstalment * (instalmentCount - 1)) * 100) /
          100
        : perInstalment;

    return {
      number: index + 1,
      dueDate: formatDate(dueDate),
      amountDue: amount,
      amountPaid: null,
      paidDate: null,
    };
  });

  return {
    method,
    taxYear,
    instalments,
    totalDue,
    totalPaid: 0,
    balance: totalDue,
  };
}
