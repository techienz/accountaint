import type { SnapshotMetrics } from "./snapshot";

/**
 * Per-metric drift between local-ledger truth and Xero-cache truth.
 * "Material" means the displayed amber banner should fire — defaults
 * to absolute > $10 OR relative > 1%, whichever is larger. Audit #129.
 *
 * Why both: a $9 drift on a $1m revenue isn't worth alarming; a $10 drift
 * on a $200 expense IS. Picking either alone misses the other case.
 */
export type DriftThreshold = {
  /** Minimum absolute difference to flag, in dollars. Default 10. */
  absolute: number;
  /** Minimum relative difference to flag, as a fraction (0.01 = 1%). Default 0.01. */
  relative: number;
};

export const DEFAULT_THRESHOLD: DriftThreshold = { absolute: 10, relative: 0.01 };

export type MetricDrift = {
  local: number;
  xero: number;
  diff: number;            // xero - local; positive = Xero higher
  diffAbs: number;
  diffPct: number;         // |diff| / max(|local|, |xero|, 1) * 100
  material: boolean;
};

export type SnapshotCompare = {
  revenue: MetricDrift;
  expenses: MetricDrift;
  netProfit: MetricDrift;
  receivables: MetricDrift;
  payables: MetricDrift;
  /** Number of metrics with material drift. Renders the headline banner. */
  materialCount: number;
};

function compareMetric(
  local: number,
  xero: number,
  threshold: DriftThreshold = DEFAULT_THRESHOLD,
): MetricDrift {
  const diff = xero - local;
  const diffAbs = Math.abs(diff);
  const denom = Math.max(Math.abs(local), Math.abs(xero), 1);
  const diffPct = Math.round((diffAbs / denom) * 10000) / 100; // two-decimal %
  const material = diffAbs > threshold.absolute || (diffAbs / denom) > threshold.relative;
  return { local, xero, diff, diffAbs, diffPct, material };
}

/**
 * Compare two SnapshotMetrics objects. Returns per-metric drift + a
 * material-count rollup. Pure / no DB / no IO. Audit #129.
 */
export function compareSnapshots(
  local: SnapshotMetrics,
  xero: SnapshotMetrics,
  threshold: DriftThreshold = DEFAULT_THRESHOLD,
): SnapshotCompare {
  const revenue = compareMetric(local.revenue.thisMonth, xero.revenue.thisMonth, threshold);
  const expenses = compareMetric(local.expenses.thisMonth, xero.expenses.thisMonth, threshold);
  const netProfit = compareMetric(local.netProfit.thisMonth, xero.netProfit.thisMonth, threshold);
  const receivables = compareMetric(local.receivables.totalOutstanding, xero.receivables.totalOutstanding, threshold);
  const payables = compareMetric(local.payables.totalOutstanding, xero.payables.totalOutstanding, threshold);

  const materialCount = [revenue, expenses, netProfit, receivables, payables].filter((m) => m.material).length;

  return { revenue, expenses, netProfit, receivables, payables, materialCount };
}

/** Format a drift line for display: "Xero $1,234.56 / local $1,200.00 (+$34.56, +2.85%)". */
export function formatDrift(d: MetricDrift): string {
  const sign = d.diff >= 0 ? "+" : "−";
  const fmt = (n: number) => "$" + Math.abs(n).toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `Xero ${fmt(d.xero)} / local ${fmt(d.local)} (${sign}${fmt(d.diffAbs)}, ${sign}${d.diffPct.toFixed(2)}%)`;
}
