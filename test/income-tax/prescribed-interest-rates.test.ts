import { describe, expect, it } from "vitest";
import {
  getPrescribedInterestRate,
  getPrescribedInterestPeriods,
  prescribedInterestRates,
} from "@/lib/tax/rules";

/**
 * Audit #77 regression tests — IRD prescribed interest rate is published
 * QUARTERLY by Order in Council. Previous bug: single annual scalar 0.0827
 * (which doesn't match any real IRD rate) carried identically across
 * 2026 + 2027 configs.
 *
 * These tests pin the timeline against IRD-published values and verify
 * the lookup helpers slice and dice it correctly.
 */
describe("getPrescribedInterestRate", () => {
  it("returns 8.41% for 2024 calendar year (carryover from Oct 2023 OIC)", () => {
    expect(getPrescribedInterestRate(new Date("2024-04-15"))).toBe(0.0841);
    expect(getPrescribedInterestRate(new Date("2024-12-31"))).toBe(0.0841);
  });

  it("returns 8.41% on the last day before the Apr 2025 cut (31 Mar 2025)", () => {
    expect(getPrescribedInterestRate(new Date("2025-03-31"))).toBe(0.0841);
  });

  it("returns 7.38% on the first day of Q1 2025 (1 Apr 2025)", () => {
    expect(getPrescribedInterestRate(new Date("2025-04-01"))).toBe(0.0738);
  });

  it("returns 6.67% for Q2 2025", () => {
    expect(getPrescribedInterestRate(new Date("2025-08-15"))).toBe(0.0667);
  });

  it("returns 6.29% for Q3 2025", () => {
    expect(getPrescribedInterestRate(new Date("2025-10-15"))).toBe(0.0629);
  });

  it("returns 5.77% from 1 Jan 2026 onwards (carryover until next OIC)", () => {
    expect(getPrescribedInterestRate(new Date("2026-01-01"))).toBe(0.0577);
    expect(getPrescribedInterestRate(new Date("2026-05-02"))).toBe(0.0577);
    // Years into the future — the open-ended row carries forward
    expect(getPrescribedInterestRate(new Date("2030-01-01"))).toBe(0.0577);
  });

  it("regression: never returns the bogus 0.0827 (the old hardcoded value)", () => {
    // Sample dates across our entire timeline — none should hit 0.0827
    const samples = [
      new Date("2024-01-01"), new Date("2024-06-15"), new Date("2024-12-31"),
      new Date("2025-04-01"), new Date("2025-08-15"), new Date("2025-12-31"),
      new Date("2026-05-02"),
    ];
    for (const d of samples) {
      expect(getPrescribedInterestRate(d), `for ${d.toISOString()}`).not.toBe(0.0827);
    }
  });

  it("throws for dates before earliest known period (data gap)", () => {
    expect(() => getPrescribedInterestRate(new Date("2020-01-01"))).toThrow(
      /No prescribed interest rate known/,
    );
  });
});

describe("getPrescribedInterestPeriods", () => {
  it("slices a NZ tax year into its quarterly rate periods", () => {
    // 2026 NZ tax year: 1 Apr 2025 - 31 Mar 2026 — spans 4 different rates
    const slices = getPrescribedInterestPeriods(
      new Date("2025-04-01"),
      new Date("2026-03-31"),
    );
    const rates = slices.map((s) => s.rate);
    expect(rates).toEqual([0.0738, 0.0667, 0.0629, 0.0577]);
  });

  it("returns a single slice for a query inside one period", () => {
    const slices = getPrescribedInterestPeriods(
      new Date("2025-08-01"),
      new Date("2025-08-31"),
    );
    expect(slices).toHaveLength(1);
    expect(slices[0].rate).toBe(0.0667);
  });

  it("clips the earliest slice to the query start (not the period start)", () => {
    const slices = getPrescribedInterestPeriods(
      new Date("2025-05-15"),
      new Date("2025-07-15"),
    );
    expect(slices[0].from.toISOString().slice(0, 10)).toBe("2025-05-15");
    expect(slices[0].rate).toBe(0.0738);
  });

  it("returns empty for an inverted range", () => {
    expect(
      getPrescribedInterestPeriods(new Date("2025-12-31"), new Date("2025-01-01")),
    ).toEqual([]);
  });
});

describe("prescribedInterestRates table integrity", () => {
  it("is sorted ASC by effectiveFrom", () => {
    for (let i = 1; i < prescribedInterestRates.length; i++) {
      expect(
        prescribedInterestRates[i].effectiveFrom > prescribedInterestRates[i - 1].effectiveFrom,
        `row ${i} (${prescribedInterestRates[i].effectiveFrom}) should follow row ${i - 1} (${prescribedInterestRates[i - 1].effectiveFrom})`,
      ).toBe(true);
    }
  });

  it("only the most recent row has effectiveTo: null", () => {
    const openEnded = prescribedInterestRates.filter((p) => p.effectiveTo === null);
    expect(openEnded).toHaveLength(1);
    expect(openEnded[0]).toBe(prescribedInterestRates[prescribedInterestRates.length - 1]);
  });

  it("every row has a source URL for audit trail", () => {
    for (const p of prescribedInterestRates) {
      expect(p.source, `${p.effectiveFrom}: missing source`).toMatch(/^https?:\/\//);
    }
  });
});
