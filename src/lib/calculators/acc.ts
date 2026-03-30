export type AccLevyResult = {
  liableEarnings: number;
  levyRate: number;
  estimatedLevy: number;
};

export function estimateACCLevy(
  liableEarnings: number,
  levyRate: number
): AccLevyResult {
  // Levy rate is per $100 of earnings
  const estimatedLevy = Math.round((liableEarnings / 100) * levyRate * 100) / 100;

  return {
    liableEarnings,
    levyRate,
    estimatedLevy,
  };
}
