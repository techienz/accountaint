export type FifHolding = {
  name: string;
  openingValue: number; // NZD value at start of tax year
  closingValue: number;
  costBasis: number;
  currency: string;
};

export type FifResult = {
  totalOpeningValue: number;
  totalCostBasis: number;
  fifIncome: number; // 5% of opening value (FDR method)
  isExempt: boolean; // true if total cost < $50,000
  holdings: (FifHolding & { fdrIncome: number })[];
};

const FDR_RATE = 0.05;
const FIF_EXEMPTION_THRESHOLD = 50000;

export function calculateFif(holdings: FifHolding[]): FifResult {
  if (holdings.length === 0) {
    return {
      totalOpeningValue: 0,
      totalCostBasis: 0,
      fifIncome: 0,
      isExempt: true,
      holdings: [],
    };
  }

  const totalCostBasis = holdings.reduce((sum, h) => sum + h.costBasis, 0);
  const isExempt = totalCostBasis < FIF_EXEMPTION_THRESHOLD;

  const totalOpeningValue = holdings.reduce((sum, h) => sum + h.openingValue, 0);

  const holdingsWithFdr = holdings.map((h) => ({
    ...h,
    fdrIncome: isExempt ? 0 : round2(h.openingValue * FDR_RATE),
  }));

  const fifIncome = isExempt
    ? 0
    : round2(totalOpeningValue * FDR_RATE);

  return {
    totalOpeningValue: round2(totalOpeningValue),
    totalCostBasis: round2(totalCostBasis),
    fifIncome,
    isExempt,
    holdings: holdingsWithFdr,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
