/**
 * IRD prescribed interest rates (FBT low-interest loans / shareholder
 * current-account / overdrawn current account interest).
 *
 * Audit #77: previously a single annual scalar on TaxYearConfig that
 * carried 0.0827 (which doesn't even match any real IRD published rate).
 * IRD publishes these QUARTERLY by Order in Council, so a single tax year
 * (Apr-Mar) can span up to four different rates.
 *
 * This timeline lives outside TaxYearConfig because IRD's quarters
 * (calendar-year-aligned) don't align with NZ tax years (1 Apr - 31 Mar).
 * Trying to nest under TaxYearConfig forces awkward Q4-of-prior-year
 * handling. A flat timeline + lookup helper is cleaner.
 *
 * To add a new quarterly OIC: append a row, set the previous open-ended
 * row's effectiveTo to the day before the new one's effectiveFrom, and
 * leave the new row's effectiveTo as null.
 *
 * Sources: IRD news + Order in Council page.
 */

export type PrescribedInterestPeriod = {
  effectiveFrom: string;       // ISO date inclusive (YYYY-MM-DD)
  effectiveTo: string | null;  // ISO date inclusive; null = open-ended (most recent)
  rate: number;                // e.g. 0.0738 = 7.38%
  source: string;              // OIC / news URL for audit trail
};

/**
 * Sorted ASC by effectiveFrom. Earliest first.
 */
export const prescribedInterestRates: PrescribedInterestPeriod[] = [
  {
    effectiveFrom: "2023-10-01",
    effectiveTo: "2025-03-31",
    rate: 0.0841,
    source: "https://www.ird.govt.nz/updates/news-folder/2023/prescribed-interest-rate-increase-fbt",
  },
  {
    effectiveFrom: "2025-04-01",
    effectiveTo: "2025-06-30",
    rate: 0.0738,
    source: "https://www.taxpolicy.ird.govt.nz/publications/2025/oic-sl-2025-64",
  },
  {
    effectiveFrom: "2025-07-01",
    effectiveTo: "2025-09-30",
    rate: 0.0667,
    source: "https://www.taxpolicy.ird.govt.nz/-/media/project/ir/tp/publications/2025/ir-leg-25-sub-0047.pdf",
  },
  {
    effectiveFrom: "2025-10-01",
    effectiveTo: "2025-12-31",
    rate: 0.0629,
    source: "https://www.ird.govt.nz/updates/news-folder/2025/fbt-prescribed-interest-rate-decrease",
  },
  {
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    rate: 0.0577,
    source: "https://www.taxpolicy.ird.govt.nz/publications/2025/oic-sl-2025-271",
  },
];

function parseIso(d: string): Date {
  return new Date(`${d}T00:00:00Z`);
}

/**
 * Returns the IRD prescribed rate effective on the given date.
 *
 * If the date is BEFORE the earliest known period, throws — that's a
 * data gap. If the date is AFTER every known effectiveTo (i.e. IRD
 * hasn't republished yet), returns the most recent open-ended row's rate.
 */
export function getPrescribedInterestRate(date: Date): number {
  const t = date.getTime();
  for (let i = prescribedInterestRates.length - 1; i >= 0; i--) {
    const p = prescribedInterestRates[i];
    const fromT = parseIso(p.effectiveFrom).getTime();
    if (t < fromT) continue;
    const toT = p.effectiveTo ? parseIso(p.effectiveTo).getTime() + 24 * 60 * 60 * 1000 - 1 : Infinity;
    if (t <= toT) return p.rate;
    return p.rate; // most recent past period (shouldn't happen if loop sorted right)
  }
  throw new Error(
    `No prescribed interest rate known for ${date.toISOString().slice(0, 10)} — earliest period starts ${prescribedInterestRates[0].effectiveFrom}`,
  );
}

export type PrescribedInterestSlice = {
  from: Date;       // start of slice (inclusive)
  to: Date;         // end of slice (inclusive)
  rate: number;
};

/**
 * Returns all (date-range, rate) slices that intersect [start, end].
 * Used by the calculator to walk a year quarter-by-quarter without
 * 365 per-day lookups. The slices are clipped to [start, end].
 */
export function getPrescribedInterestPeriods(
  start: Date,
  end: Date,
): PrescribedInterestSlice[] {
  if (start.getTime() > end.getTime()) return [];
  const out: PrescribedInterestSlice[] = [];

  for (const p of prescribedInterestRates) {
    const pFrom = parseIso(p.effectiveFrom);
    const pTo = p.effectiveTo
      ? new Date(parseIso(p.effectiveTo).getTime() + 24 * 60 * 60 * 1000 - 1)
      : new Date(8.64e15); // far future
    // Clip to query range
    const sliceFrom = pFrom.getTime() > start.getTime() ? pFrom : start;
    const sliceTo = pTo.getTime() < end.getTime() ? pTo : end;
    if (sliceFrom.getTime() > sliceTo.getTime()) continue;
    out.push({ from: sliceFrom, to: sliceTo, rate: p.rate });
  }
  return out;
}
