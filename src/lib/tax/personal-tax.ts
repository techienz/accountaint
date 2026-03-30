import type { TaxBracket } from "./rules/types";
import { getTaxYearConfig } from "./rules";

export type PersonalTaxResult = {
  taxableIncome: number;
  totalTax: number;
  effectiveRate: number;
  bracketBreakdown: {
    from: number;
    to: number;
    rate: number;
    taxableAmount: number;
    tax: number;
  }[];
};

export function calculatePersonalTax(
  taxableIncome: number,
  taxYear: number
): PersonalTaxResult {
  const config = getTaxYearConfig(taxYear);
  const brackets = config.personalIncomeTaxBrackets;

  const breakdown = calculateBracketBreakdown(taxableIncome, brackets);
  const totalTax = breakdown.reduce((sum, b) => sum + b.tax, 0);

  return {
    taxableIncome,
    totalTax: Math.round(totalTax * 100) / 100,
    effectiveRate: taxableIncome > 0 ? totalTax / taxableIncome : 0,
    bracketBreakdown: breakdown,
  };
}

export function calculateBracketBreakdown(
  taxableIncome: number,
  brackets: TaxBracket[]
) {
  const breakdown: PersonalTaxResult["bracketBreakdown"] = [];
  let remaining = Math.max(0, taxableIncome);
  let previousThreshold = 0;

  for (const bracket of brackets) {
    if (remaining <= 0) break;

    const bandSize = bracket.threshold - previousThreshold;
    const taxableAmount = Math.min(remaining, bandSize);
    const tax = taxableAmount * bracket.rate;

    breakdown.push({
      from: previousThreshold,
      to: Math.min(bracket.threshold, previousThreshold + taxableAmount),
      rate: bracket.rate,
      taxableAmount,
      tax: Math.round(tax * 100) / 100,
    });

    remaining -= taxableAmount;
    previousThreshold = bracket.threshold;
  }

  return breakdown;
}
