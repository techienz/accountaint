import type { GstPeriod } from "./calculator";
import { formatDateNZ, parseDateLocal } from "@/lib/utils/dates";

export function generateGstPeriods(
  filingPeriod: string,
  balanceDate: string,
  count: number
): GstPeriod[] {
  const periods: GstPeriod[] = [];
  const [balMonth] = balanceDate.split("-").map(Number);

  let intervalMonths: number;
  if (filingPeriod === "monthly") intervalMonths = 1;
  else if (filingPeriod === "2monthly") intervalMonths = 2;
  else intervalMonths = 6;

  // Start from the current period and work backwards
  const now = new Date();
  let periodEnd = new Date(now.getFullYear(), now.getMonth(), 0); // end of last month

  // Align to filing period boundary
  if (filingPeriod === "6monthly") {
    const secondMonth = balMonth <= 6 ? balMonth + 6 : balMonth - 6;
    const months = [balMonth, secondMonth].sort((a, b) => a - b);
    for (let y = now.getFullYear(); y >= now.getFullYear() - 1; y--) {
      for (let i = months.length - 1; i >= 0; i--) {
        const candidate = new Date(y, months[i], 0);
        if (candidate <= now) {
          periodEnd = candidate;
          break;
        }
      }
      if (periodEnd <= now) break;
    }
  } else if (filingPeriod === "2monthly") {
    const twoMonthEnds = [1, 3, 5, 7, 9, 11];
    const currentMonth = now.getMonth() + 1;
    let endMonth = twoMonthEnds.filter((m) => m <= currentMonth).pop() || 11;
    let endYear = now.getFullYear();
    if (endMonth > currentMonth) {
      endYear--;
    }
    periodEnd = new Date(endYear, endMonth, 0);
  }

  for (let i = 0; i < count; i++) {
    const to = new Date(periodEnd);
    const from = new Date(to.getFullYear(), to.getMonth() - intervalMonths + 1, 1);

    periods.push({
      from: formatDateNZ(from),
      to: formatDateNZ(to),
    });

    periodEnd = new Date(from.getFullYear(), from.getMonth(), 0);
  }

  return periods.reverse();
}

export function formatPeriod(from: string, to: string): string {
  const f = parseDateLocal(from);
  const t = parseDateLocal(to);
  return `${f.toLocaleDateString("en-NZ", { month: "short", year: "numeric" })} — ${t.toLocaleDateString("en-NZ", { month: "short", year: "numeric" })}`;
}
