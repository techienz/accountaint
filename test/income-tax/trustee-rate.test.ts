import { describe, expect, it } from "vitest";
import { getTaxYearConfig } from "@/lib/tax/rules";

/**
 * Trustee tax rate is 39% from 1 April 2024 (Trustee Tax Rate Increase Act 2024).
 * A $10,000 de minimis at 33% applies to small trusts (per IR1043) — but the
 * HEADLINE rate is 39%.
 *
 * Source: https://www.taxtechnical.ird.govt.nz/-/media/project/ir/tt/pdfs/legislation/2024/53-2024.pdf
 *         https://www.ird.govt.nz/roles/trusts-and-estates
 *
 * This test pins the headline rate so it can't silently drift back to 33%.
 * Audit finding #64 (2026-05-01).
 */

describe("Trustee tax rate (IRD-published)", () => {
  it("2026 trustee rate is 39% (headline)", () => {
    const config = getTaxYearConfig(2026);
    expect(config.incomeTaxRate.trust).toBe(0.39);
  });

  it("2027 trustee rate is 39% (headline)", () => {
    const config = getTaxYearConfig(2027);
    expect(config.incomeTaxRate.trust).toBe(0.39);
  });

  it("trustee rate is NOT 33% (regression — see audit finding #64)", () => {
    expect(getTaxYearConfig(2026).incomeTaxRate.trust).not.toBe(0.33);
    expect(getTaxYearConfig(2027).incomeTaxRate.trust).not.toBe(0.33);
  });

  it("company rate is still 28% (unchanged by trustee rate fix)", () => {
    expect(getTaxYearConfig(2026).incomeTaxRate.company).toBe(0.28);
    expect(getTaxYearConfig(2027).incomeTaxRate.company).toBe(0.28);
  });
});
