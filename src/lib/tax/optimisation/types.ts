export type OptimisationSnapshot = {
  taxYear: number;
  balanceDate: string;
  daysToBalanceDate: number;
  entityType: string;

  companyProfit: number;
  revenue: number;
  expenses: Record<string, number>;

  currentSalary: number;
  currentDividends: number;
  otherPersonalIncome: number;
  hasStudentLoan: boolean;

  shareholderAccountBalance: number;
  prescribedInterestCharged: boolean;

  homeOfficeClaim: { method: string; amount: number } | null;
  vehicleClaim: { method: string; amount: number } | null;

  recentAssetPurchases: { description: string; cost: number; date: string }[];
  totalAssetValue: number;

  kiwisaver: {
    enrolled: boolean;
    employeeRate: number;
    employerRate: number;
    salary: number;
    esctBracket: number;
  };

  gst: {
    registered: boolean;
    basis: string | null;
    filingPeriod: string | null;
  };

  provisionalTax: {
    method: string | null;
    priorYearRIT: number | null;
  };

  upcomingInvoices: { amount: number; client: string }[];
  outstandingReceivables: number;

  accCuCode: string | null;
  donations: number;
};

export type TaxRecommendation = {
  id: string;
  strategy: string;
  currentApproach: string;
  optimisedApproach: string;
  annualSaving: number;
  riskLevel: "safe" | "moderate" | "aggressive";
  riskNote: string | null;
  actionType: "auto" | "reminder" | "info";
  actionDetails: string;
  irdReference: string | null;
};
