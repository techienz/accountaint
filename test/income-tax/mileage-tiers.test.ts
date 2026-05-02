import { describe, expect, it } from "vitest";
import { calculateMileageClaim } from "@/lib/calculators/vehicle";
import { getTaxYearConfig } from "@/lib/tax/rules";

/**
 * Audit #72 — IRD kilometre-rate method actually uses Tier 1 / Tier 2
 * with a 14,000 km TOTAL vehicle km cap and per-fuel-type rates.
 * Plus a separate 3,500 km safe harbour for employee reimbursement
 * without a logbook (OS 19/04b).
 *
 * Tests cover:
 *  - Below cap → all Tier 1
 *  - Above cap → split correctly
 *  - Cap is on TOTAL km, not business km (subtle!)
 *  - Per-fuel-type rates resolve correctly
 *  - 3,500 km no-logbook rule applies only to employee_reimbursement
 *  - Self-employed regime ignores hasLogbook
 */
describe("calculateMileageClaim", () => {
  const config = getTaxYearConfig(2026).kilometreRates;

  describe("self-employed (OS 19/04a)", () => {
    it("100% business, total km below cap: all Tier 1 (petrol)", () => {
      const r = calculateMileageClaim({
        fuelType: "petrol",
        totalVehicleKm: 10000,
        totalBusinessKm: 10000,
        kilometreRates: config,
        regime: "self_employed",
      });
      // 10,000 × $1.17 = $11,700
      expect(r.totalClaim).toBe(11700);
      expect(r.mileageDetail?.tier1Claim).toBe(11700);
      expect(r.mileageDetail?.tier2Claim).toBe(0);
    });

    it("100% business, total km above cap: Tier 1 then Tier 2 (petrol)", () => {
      const r = calculateMileageClaim({
        fuelType: "petrol",
        totalVehicleKm: 20000,
        totalBusinessKm: 20000,
        kilometreRates: config,
        regime: "self_employed",
      });
      // First 14,000 km @ $1.17 = $16,380
      // Next  6,000 km @ $0.37 = $2,220
      expect(r.mileageDetail?.tier1BusinessKm).toBe(14000);
      expect(r.mileageDetail?.tier2BusinessKm).toBe(6000);
      expect(r.totalClaim).toBe(16380 + 2220);
    });

    it("60% business, 20,000 total km: cap is on TOTAL km not business km", () => {
      // Subtle: total = 20,000 km. Cap at 14,000 total km.
      // Business proportion = 12,000 / 20,000 = 0.6.
      // Tier 1 business km = 14,000 × 0.6 = 8,400
      // Tier 2 business km =  6,000 × 0.6 = 3,600
      // NOT "all 12,000 business km at Tier 1" (the wrong/naive answer).
      const r = calculateMileageClaim({
        fuelType: "petrol",
        totalVehicleKm: 20000,
        totalBusinessKm: 12000,
        kilometreRates: config,
        regime: "self_employed",
      });
      expect(r.mileageDetail?.tier1BusinessKm).toBe(8400);
      expect(r.mileageDetail?.tier2BusinessKm).toBe(3600);
      // 8,400 × $1.17 = $9,828
      // 3,600 × $0.37 = $1,332
      expect(r.totalClaim).toBe(9828 + 1332);
    });

    it("uses diesel rates when fuelType=diesel", () => {
      const r = calculateMileageClaim({
        fuelType: "diesel",
        totalVehicleKm: 1000,
        totalBusinessKm: 1000,
        kilometreRates: config,
        regime: "self_employed",
      });
      // 1000 × $1.26 = $1,260
      expect(r.totalClaim).toBe(1260);
      expect(r.mileageDetail?.tier1Rate).toBe(1.26);
    });

    it("uses electric rates when fuelType=electric", () => {
      const r = calculateMileageClaim({
        fuelType: "electric",
        totalVehicleKm: 14000,
        totalBusinessKm: 14000,
        kilometreRates: config,
        regime: "self_employed",
      });
      // 14,000 × $1.08 = $15,120 (cap at exactly Tier 1)
      expect(r.totalClaim).toBe(15120);
    });

    it("hasLogbook=false is ignored for self-employed (OS 19/04a)", () => {
      // 3,500 km rule is OS 19/04b only — self-employed regime ignores it.
      const r = calculateMileageClaim({
        fuelType: "petrol",
        totalVehicleKm: 10000,
        totalBusinessKm: 10000,
        kilometreRates: config,
        regime: "self_employed",
        hasLogbook: false,
      });
      // Still 10,000 km × $1.17 = $11,700 (no 3,500 cap applied)
      expect(r.totalClaim).toBe(11700);
    });
  });

  describe("employee reimbursement (OS 19/04b)", () => {
    it("WITH logbook: same as self-employed (uses 14,000 total-km cap)", () => {
      const r = calculateMileageClaim({
        fuelType: "petrol",
        totalVehicleKm: 20000,
        totalBusinessKm: 12000,
        kilometreRates: config,
        regime: "employee_reimbursement",
        hasLogbook: true,
      });
      expect(r.mileageDetail?.tier1BusinessKm).toBe(8400);
      expect(r.mileageDetail?.tier2BusinessKm).toBe(3600);
    });

    it("WITHOUT logbook: Tier 1 capped at 3,500 BUSINESS km", () => {
      const r = calculateMileageClaim({
        fuelType: "petrol",
        totalVehicleKm: 50000,
        totalBusinessKm: 10000,
        kilometreRates: config,
        regime: "employee_reimbursement",
        hasLogbook: false,
      });
      // No-logbook safe harbour: first 3,500 BUSINESS km @ Tier 1, rest @ Tier 2
      expect(r.mileageDetail?.tier1BusinessKm).toBe(3500);
      expect(r.mileageDetail?.tier2BusinessKm).toBe(6500);
      expect(r.mileageDetail?.capUsedKm).toBe(3500);
      // 3,500 × $1.17 = $4,095
      // 6,500 × $0.37 = $2,405
      expect(r.totalClaim).toBe(4095 + 2405);
    });

    it("WITHOUT logbook AND below 3,500 km: all Tier 1", () => {
      const r = calculateMileageClaim({
        fuelType: "petrol",
        totalVehicleKm: 20000,
        totalBusinessKm: 2000,
        kilometreRates: config,
        regime: "employee_reimbursement",
        hasLogbook: false,
      });
      expect(r.mileageDetail?.tier1BusinessKm).toBe(2000);
      expect(r.mileageDetail?.tier2BusinessKm).toBe(0);
    });
  });

  describe("regression: legacy 0.99 rate is no longer the default", () => {
    it("petrol Tier 1 in 2026 config is $1.17 not $0.99", () => {
      expect(config.rates.petrol.tier1).toBe(1.17);
      expect(config.rates.petrol.tier1).not.toBe(0.99);
    });
  });
});
