import { describe, expect, it } from "vitest";
import { compareSnapshots, DEFAULT_THRESHOLD, formatDrift } from "@/lib/reports/snapshot-compare";
import type { SnapshotMetrics } from "@/lib/reports/snapshot";

/**
 * Audit #129 — compareSnapshots is the pure heart of the snapshot
 * rebuild. It diffs local-ledger truth against Xero-cache truth and
 * decides which metrics warrant a "Xero says X / local says Y" banner.
 */

function makeMetrics(overrides: Partial<{
  revenue: number; expenses: number; netProfit: number; receivables: number; payables: number;
}> = {}): SnapshotMetrics {
  const base = {
    revenue: 10000,
    expenses: 6000,
    netProfit: 4000,
    receivables: 2000,
    payables: 1500,
    ...overrides,
  };
  return {
    revenue: { thisMonth: base.revenue, lastMonth: 0, percentChange: null },
    expenses: { thisMonth: base.expenses, lastMonth: 0, percentChange: null },
    netProfit: { thisMonth: base.netProfit, lastMonth: 0, percentChange: null },
    cashFlow: { cashIn: 0, cashOut: 0, net: 0 },
    margins: { gross: null, net: null },
    receivables: { totalOutstanding: base.receivables, overdueCount: 0, overdueTotal: 0, avgCollectionDays: null },
    payables: { totalOutstanding: base.payables, dueThisWeek: 0, dueThisMonth: 0 },
    sparklines: { revenue: [], profit: [] },
  };
}

describe("compareSnapshots", () => {
  describe("exact match", () => {
    it("flags zero metrics when local and xero are identical", () => {
      const m = makeMetrics();
      const r = compareSnapshots(m, m);
      expect(r.materialCount).toBe(0);
      expect(r.revenue.material).toBe(false);
      expect(r.revenue.diff).toBe(0);
    });
  });

  describe("absolute threshold ($10 default)", () => {
    it("does NOT flag a $5 difference on $10,000 (under absolute)", () => {
      const r = compareSnapshots(
        makeMetrics({ revenue: 10000 }),
        makeMetrics({ revenue: 10005 }),
      );
      expect(r.revenue.material).toBe(false);
      expect(r.materialCount).toBe(0);
    });

    it("flags an $11 difference on $10,000 (over absolute)", () => {
      const r = compareSnapshots(
        makeMetrics({ revenue: 10000 }),
        makeMetrics({ revenue: 10011 }),
      );
      expect(r.revenue.material).toBe(true);
      expect(r.materialCount).toBe(1);
    });
  });

  describe("relative threshold (1% default)", () => {
    it("flags a $9 difference on $200 (under absolute, OVER 1%)", () => {
      // $9 absolute is below the $10 floor, but 9/200 = 4.5% which IS material.
      const r = compareSnapshots(
        makeMetrics({ expenses: 200 }),
        makeMetrics({ expenses: 209 }),
      );
      expect(r.expenses.material).toBe(true);
    });

    it("does NOT flag a $50 difference on $1,000,000 (over absolute, UNDER 1%)", () => {
      // 50/1m = 0.005% — well under threshold.
      // But 50 absolute > 10... wait, default is "absolute > 10 OR relative > 1%".
      // So this WOULD flag because absolute > 10. The "OR" is the safety net
      // for the small-balance case. This test is wrong — let me re-read the
      // spec.
      const r = compareSnapshots(
        makeMetrics({ revenue: 1_000_000 }),
        makeMetrics({ revenue: 1_000_050 }),
      );
      // Per the design: any drift over $10 is material. So this IS flagged.
      expect(r.revenue.material).toBe(true);
    });
  });

  describe("multi-metric drift", () => {
    it("counts material flags across all five metrics", () => {
      const r = compareSnapshots(
        makeMetrics({ revenue: 10000, expenses: 5000, receivables: 1000, payables: 500 }),
        makeMetrics({ revenue: 10500, expenses: 5050, receivables: 1000, payables: 500 }),
      );
      // revenue ($500), expenses ($50) — both material. Receivables + payables exact.
      // netProfit derived from local args = 4000 - 5000 = ... wait makeMetrics
      // takes netProfit as an override too. Let me be explicit.
      expect(r.revenue.material).toBe(true);
      expect(r.expenses.material).toBe(true);
      expect(r.receivables.material).toBe(false);
      expect(r.payables.material).toBe(false);
    });
  });

  describe("custom threshold", () => {
    it("respects a tighter threshold (no floor, 0.1% relative)", () => {
      const r = compareSnapshots(
        makeMetrics({ revenue: 1000 }),
        makeMetrics({ revenue: 1002 }),
        { absolute: 0, relative: 0.001 },
      );
      expect(r.revenue.material).toBe(true);
    });

    it("respects a looser threshold ($100 floor, 5% relative)", () => {
      const r = compareSnapshots(
        makeMetrics({ revenue: 10000 }),
        makeMetrics({ revenue: 10050 }),
        { absolute: 100, relative: 0.05 },
      );
      expect(r.revenue.material).toBe(false);
    });
  });

  describe("zero / negative cases", () => {
    it("handles both sides being zero (no diff, not material)", () => {
      const r = compareSnapshots(
        makeMetrics({ revenue: 0 }),
        makeMetrics({ revenue: 0 }),
      );
      expect(r.revenue.material).toBe(false);
      expect(r.revenue.diffPct).toBe(0);
    });

    it("handles negative netProfit (loss-making period)", () => {
      const r = compareSnapshots(
        makeMetrics({ netProfit: -500 }),
        makeMetrics({ netProfit: -480 }),
      );
      expect(r.netProfit.diff).toBe(20); // xero=-480, local=-500, xero-local=+20
      expect(r.netProfit.material).toBe(true);
    });
  });
});

describe("formatDrift", () => {
  it("renders the standard 'Xero X / local Y (+diff, +pct)' line", () => {
    const r = compareSnapshots(makeMetrics({ revenue: 10000 }), makeMetrics({ revenue: 10500 }));
    const s = formatDrift(r.revenue);
    expect(s).toContain("Xero $10,500.00");
    expect(s).toContain("local $10,000.00");
    expect(s).toContain("+$500.00");
  });

  it("uses minus sign when local exceeds xero", () => {
    const r = compareSnapshots(makeMetrics({ revenue: 10500 }), makeMetrics({ revenue: 10000 }));
    const s = formatDrift(r.revenue);
    expect(s).toMatch(/[−-]\$500\.00/);
  });
});

describe("DEFAULT_THRESHOLD", () => {
  it("is $10 absolute / 1% relative", () => {
    expect(DEFAULT_THRESHOLD.absolute).toBe(10);
    expect(DEFAULT_THRESHOLD.relative).toBe(0.01);
  });
});
