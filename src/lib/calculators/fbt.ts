export type FbtBenefit = {
  description: string;
  value: number;
  category: string; // vehicle, low_interest_loan, other
};

export type FbtResult = {
  benefits: FbtBenefit[];
  totalTaxableValue: number;
  fbtRate: number;
  fbtPayable: number;
};

export function calculateFBT(
  benefits: FbtBenefit[],
  fbtRate: number
): FbtResult {
  const totalTaxableValue = benefits.reduce((sum, b) => sum + b.value, 0);
  const fbtPayable = Math.round(totalTaxableValue * fbtRate * 100) / 100;

  return {
    benefits,
    totalTaxableValue,
    fbtRate,
    fbtPayable,
  };
}
