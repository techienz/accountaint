import { describe, expect, it } from "vitest";

/**
 * GST math sanity. NZ GST is 15% (since 1 Oct 2010).
 * - Add GST to exclusive: amount × 1.15
 * - Extract GST from inclusive: amount × 3/23 (i.e. amount / 23 × 3)
 *   equivalent: inclusive_amount - inclusive_amount/1.15
 *
 * These are pure math identities; no helper functions for them exist in the
 * codebase yet (calculateGstReturn handles aggregation, not single-amount
 * conversion). Tests document the canonical math so any future helper can be
 * checked against them.
 */

const GST_RATE = 0.15;

function gstAddedToExclusive(exclusive: number): number {
  return Math.round(exclusive * GST_RATE * 100) / 100;
}

function gstExtractedFromInclusive(inclusive: number): number {
  return Math.round(inclusive * (3 / 23) * 100) / 100;
}

function inclusiveToExclusive(inclusive: number): number {
  return Math.round((inclusive / 1.15) * 100) / 100;
}

describe("GST math identities (15%)", () => {
  it("$100 exclusive → $15 GST → $115 inclusive", () => {
    expect(gstAddedToExclusive(100)).toBe(15);
  });

  it("$115 inclusive → $15 GST extracted", () => {
    expect(gstExtractedFromInclusive(115)).toBe(15);
  });

  it("$115 inclusive → $100 exclusive", () => {
    expect(inclusiveToExclusive(115)).toBe(100);
  });

  it("$1,000 exclusive ↔ $1,150 inclusive ↔ $150 GST", () => {
    expect(gstAddedToExclusive(1000)).toBe(150);
    expect(gstExtractedFromInclusive(1150)).toBe(150);
    expect(inclusiveToExclusive(1150)).toBe(1000);
  });

  it("round-trip: exclusive → inclusive → exclusive (no drift on round numbers)", () => {
    const exclusive = 500;
    const inclusive = exclusive + gstAddedToExclusive(exclusive);
    expect(inclusiveToExclusive(inclusive)).toBe(exclusive);
  });

  it("rounds half-up to two decimal places: $99.99 inclusive GST", () => {
    // 99.99 × 3/23 = 13.0421... → 13.04
    expect(gstExtractedFromInclusive(99.99)).toBe(13.04);
  });
});
