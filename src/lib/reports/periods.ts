/**
 * Calculate date ranges for report presets based on balance date.
 */

type DateRange = { from: string; to: string };

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseBalanceDate(balanceDate: string): { month: number; day: number } {
  const [mm, dd] = balanceDate.split("-").map(Number);
  return { month: mm, day: dd };
}

export type PresetPeriod =
  | "this_month"
  | "this_quarter"
  | "this_tax_year"
  | "ytd"
  | "last_tax_year"
  | "custom";

export function getPresetPeriod(
  preset: PresetPeriod,
  balanceDate: string,
  today: Date = new Date()
): DateRange | null {
  if (preset === "custom") return null;

  const { month: balMonth, day: balDay } = parseBalanceDate(balanceDate);

  if (preset === "this_month") {
    const from = new Date(today.getFullYear(), today.getMonth(), 1);
    const to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { from: formatDate(from), to: formatDate(to) };
  }

  if (preset === "this_quarter") {
    const quarterMonth = Math.floor(today.getMonth() / 3) * 3;
    const from = new Date(today.getFullYear(), quarterMonth, 1);
    const to = new Date(today.getFullYear(), quarterMonth + 3, 0);
    return { from: formatDate(from), to: formatDate(to) };
  }

  if (preset === "this_tax_year") {
    // Tax year starts the day after balance date
    const balDate = new Date(today.getFullYear(), balMonth - 1, balDay);
    let yearStart: Date;

    if (today > balDate) {
      // We're past balance date this calendar year, so tax year started this year
      yearStart = new Date(today.getFullYear(), balMonth - 1, balDay + 1);
    } else {
      // We're before balance date, so tax year started last year
      yearStart = new Date(today.getFullYear() - 1, balMonth - 1, balDay + 1);
    }

    const yearEnd = new Date(yearStart.getFullYear() + 1, balMonth - 1, balDay);
    return { from: formatDate(yearStart), to: formatDate(yearEnd) };
  }

  if (preset === "ytd") {
    const balDate = new Date(today.getFullYear(), balMonth - 1, balDay);
    let yearStart: Date;

    if (today > balDate) {
      yearStart = new Date(today.getFullYear(), balMonth - 1, balDay + 1);
    } else {
      yearStart = new Date(today.getFullYear() - 1, balMonth - 1, balDay + 1);
    }

    return { from: formatDate(yearStart), to: formatDate(today) };
  }

  if (preset === "last_tax_year") {
    const balDate = new Date(today.getFullYear(), balMonth - 1, balDay);
    let lastYearEnd: Date;

    if (today > balDate) {
      lastYearEnd = new Date(today.getFullYear(), balMonth - 1, balDay);
    } else {
      lastYearEnd = new Date(today.getFullYear() - 1, balMonth - 1, balDay);
    }

    const lastYearStart = new Date(lastYearEnd.getFullYear() - 1, balMonth - 1, balDay + 1);
    return { from: formatDate(lastYearStart), to: formatDate(lastYearEnd) };
  }

  return null;
}
