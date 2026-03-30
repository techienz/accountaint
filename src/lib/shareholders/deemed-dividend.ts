import { getRunningBalance } from "./balance";

export type DeemedDividendResult = {
  hasDeemedDividend: boolean;
  maxOverdrawnAmount: number;
  warning: string | null;
};

export async function checkDeemedDividend(
  shareholderId: string,
  taxYear: string,
  businessId: string
): Promise<DeemedDividendResult> {
  const balance = await getRunningBalance(shareholderId, taxYear, businessId);

  if (balance.minBalance >= 0) {
    return {
      hasDeemedDividend: false,
      maxOverdrawnAmount: 0,
      warning: null,
    };
  }

  const maxOverdrawnAmount = Math.abs(balance.minBalance);

  return {
    hasDeemedDividend: true,
    maxOverdrawnAmount,
    warning: `Shareholder current account was overdrawn by up to $${maxOverdrawnAmount.toLocaleString()} during the ${taxYear} tax year. This may be treated as a deemed dividend under section CD 4 of the Income Tax Act 2007. Consider making repayments or declaring a salary/dividend to clear the balance.`,
  };
}
