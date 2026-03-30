export type DepreciationMethod = "DV" | "SL";

export type DepreciationResult = {
  depreciationAmount: number;
  closingBookValue: number;
};

export type DisposalResult = {
  depreciationRecovered: number;
  lossOnSale: number;
};

/**
 * Calculate annual depreciation for an asset.
 *
 * DV (diminishing value): rate applied to opening book value, pro-rated by months owned.
 * SL (straight line): rate applied to original cost, pro-rated by months owned.
 */
export function calculateAnnualDepreciation(
  cost: number,
  openingBookValue: number,
  method: DepreciationMethod,
  rate: number,
  monthsOwned: number
): DepreciationResult {
  const proRata = Math.min(monthsOwned, 12) / 12;

  let depreciationAmount: number;
  if (method === "DV") {
    depreciationAmount = openingBookValue * rate * proRata;
  } else {
    depreciationAmount = cost * rate * proRata;
  }

  // Cannot depreciate below zero
  depreciationAmount = Math.min(depreciationAmount, openingBookValue);
  depreciationAmount = Math.round(depreciationAmount * 100) / 100;

  return {
    depreciationAmount,
    closingBookValue:
      Math.round((openingBookValue - depreciationAmount) * 100) / 100,
  };
}

/**
 * Calculate depreciation recovered or loss on sale when disposing an asset.
 *
 * If salePrice > bookValue → depreciation recovered (taxable income)
 * If salePrice < bookValue → loss on sale (deductible)
 * Recovery is capped at original cost (no profit element).
 */
export function calculateDisposal(
  cost: number,
  bookValue: number,
  salePrice: number
): DisposalResult {
  if (salePrice >= bookValue) {
    // Recovery capped at cost - no profit beyond original cost
    const cappedSalePrice = Math.min(salePrice, cost);
    return {
      depreciationRecovered:
        Math.round((cappedSalePrice - bookValue) * 100) / 100,
      lossOnSale: 0,
    };
  }
  return {
    depreciationRecovered: 0,
    lossOnSale: Math.round((bookValue - salePrice) * 100) / 100,
  };
}
