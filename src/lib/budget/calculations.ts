import {
  getOrCreateBudgetConfig,
  listIncomes,
  listRecurringItems,
  listOneOffExpenses,
  listDebts,
  listSavingsGoals,
  listHolidays,
  listCategories,
  listBankAccounts,
  listInvestments,
} from "./index";

// ── Fortnightly conversion ──────────────────────────────────────────────

export function monthlyToFortnightly(monthly: number): number {
  return Math.round((monthly * 12) / 26 * 100) / 100;
}

export function fortnightlyToMonthly(fortnightly: number): number {
  return Math.round((fortnightly * 26) / 12 * 100) / 100;
}

// ── Pay period boundaries ───────────────────────────────────────────────

export function getPayPeriodBoundaries(
  anchorDate: string,
  frequency: string,
  referenceDate?: Date
) {
  const ref = referenceDate ?? new Date();
  ref.setHours(0, 0, 0, 0);
  const anchor = new Date(anchorDate);
  anchor.setHours(0, 0, 0, 0);

  const periodDays = frequency === "weekly" ? 7 : frequency === "monthly" ? 30 : 14;

  if (frequency === "monthly") {
    const start = new Date(ref.getFullYear(), ref.getMonth(), anchor.getDate());
    if (start > ref) start.setMonth(start.getMonth() - 1);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    end.setDate(end.getDate() - 1);
    return { start, end };
  }

  // Walk from anchor to find the period containing ref
  const diffMs = ref.getTime() - anchor.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const periodsElapsed = Math.floor(diffDays / periodDays);

  const start = new Date(anchor);
  start.setDate(start.getDate() + periodsElapsed * periodDays);
  if (start > ref) {
    start.setDate(start.getDate() - periodDays);
  }

  const end = new Date(start);
  end.setDate(end.getDate() + periodDays - 1);

  return { start, end };
}

export function getCurrentPayPeriod(config: {
  pay_anchor_date: string;
  pay_frequency: string;
}) {
  return getPayPeriodBoundaries(config.pay_anchor_date, config.pay_frequency);
}

export function getNextPayPeriod(config: {
  pay_anchor_date: string;
  pay_frequency: string;
}) {
  const current = getCurrentPayPeriod(config);
  const nextStart = new Date(current.end);
  nextStart.setDate(nextStart.getDate() + 1);
  return getPayPeriodBoundaries(
    config.pay_anchor_date,
    config.pay_frequency,
    nextStart
  );
}

// ── "This Fortnight" view ───────────────────────────────────────────────

export function getItemsDueInPeriod(
  items: { due_day: number | null; is_active: boolean; name: string; monthly_amount: number }[],
  period: { start: Date; end: Date }
) {
  const result: typeof items = [];
  for (const item of items) {
    if (!item.is_active || item.due_day == null) continue;

    // Check each day in the period for matching due_day
    const cursor = new Date(period.start);
    while (cursor <= period.end) {
      if (cursor.getDate() === item.due_day) {
        result.push(item);
        break;
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return result;
}

// ── Investment returns ──────────────────────────────────────────────────

export function calculateInvestmentReturn(investment: {
  cost_basis: number;
  current_value: number;
  nzd_rate: number;
  purchase_date: string | null;
}) {
  const currentNzd = investment.current_value * investment.nzd_rate;
  const costNzd = investment.cost_basis * investment.nzd_rate;
  const totalReturn = currentNzd - costNzd;
  const returnPct = costNzd > 0 ? (totalReturn / costNzd) * 100 : 0;

  let annualisedReturn: number | null = null;
  if (investment.purchase_date && costNzd > 0 && currentNzd > 0) {
    const purchaseMs = new Date(investment.purchase_date).getTime();
    const nowMs = Date.now();
    const years = (nowMs - purchaseMs) / (1000 * 60 * 60 * 24 * 365.25);
    if (years >= 0.01) {
      // CAGR = (endValue/startValue)^(1/years) - 1
      annualisedReturn =
        (Math.pow(currentNzd / costNzd, 1 / years) - 1) * 100;
    }
  }

  return {
    totalReturn: Math.round(totalReturn * 100) / 100,
    returnPct: Math.round(returnPct * 100) / 100,
    annualisedReturn:
      annualisedReturn != null
        ? Math.round(annualisedReturn * 100) / 100
        : null,
  };
}

export function calculatePortfolioAllocation(
  investments: {
    type: string;
    current_value: number;
    nzd_rate: number;
    status: string;
  }[]
) {
  const active = investments.filter((i) => i.status === "active");
  const totalNzd = active.reduce(
    (s, i) => s + i.current_value * i.nzd_rate,
    0
  );

  const byType: Record<string, { value: number; pct: number }> = {};
  for (const inv of active) {
    const nzdValue = inv.current_value * inv.nzd_rate;
    if (!byType[inv.type]) byType[inv.type] = { value: 0, pct: 0 };
    byType[inv.type].value += nzdValue;
  }
  for (const type of Object.keys(byType)) {
    byType[type].pct =
      totalNzd > 0
        ? Math.round((byType[type].value / totalNzd) * 10000) / 100
        : 0;
    byType[type].value = Math.round(byType[type].value * 100) / 100;
  }

  return { totalNzd: Math.round(totalNzd * 100) / 100, byType };
}

// ── Overview summary ────────────────────────────────────────────────────

export function getBudgetOverview(userId: string) {
  const config = getOrCreateBudgetConfig(userId);
  const incomes = listIncomes(userId).filter((i) => i.is_active);
  const recurring = listRecurringItems(userId);
  const activeRecurring = recurring.filter((r) => r.is_active);
  const oneOffs = listOneOffExpenses(userId);
  const debts = listDebts(userId).filter((d) => d.status === "active");
  const savings = listSavingsGoals(userId).filter((s) => s.status === "active");
  const categories = listCategories(userId);
  const holidays = listHolidays(userId);

  const totalMonthlyIncome = incomes.reduce((s, i) => s + i.monthly_amount, 0);
  const totalFortnightlyIncome = monthlyToFortnightly(totalMonthlyIncome);

  const totalMonthlyExpenses = activeRecurring
    .filter((r) => !r.is_debt)
    .reduce((s, r) => s + r.monthly_amount, 0);
  const totalFortnightlyExpenses = monthlyToFortnightly(totalMonthlyExpenses);

  // Debt total includes both budgetDebts repayments AND recurring items marked as debt
  const debtFromDebtsTable = debts.reduce((s, d) => s + d.monthly_repayment, 0);
  const debtFromRecurring = activeRecurring
    .filter((r) => r.is_debt)
    .reduce((s, r) => s + r.monthly_amount, 0);
  const totalMonthlyDebt = debtFromDebtsTable + debtFromRecurring;
  const totalDebtBalance = debts.reduce((s, d) => s + d.balance, 0);
  const bankAccounts = listBankAccounts(userId).filter((a) => a.is_active);
  const totalBankBalance = bankAccounts.reduce((s, a) => s + a.balance, 0);
  const totalSavingsBalance = savings.reduce((s, g) => s + g.current_balance, 0);
  const investments = listInvestments(userId).filter((i) => i.status === "active");
  const totalInvestmentValue = investments.reduce(
    (s, i) => s + i.current_value * i.nzd_rate,
    0
  );
  const netWorth =
    totalBankBalance + totalSavingsBalance + totalInvestmentValue - totalDebtBalance;
  const totalMonthlySavings = savings.reduce(
    (s, g) => s + fortnightlyToMonthly(g.fortnightly_contribution),
    0
  );

  const monthlyRemaining =
    totalMonthlyIncome - totalMonthlyExpenses - totalMonthlyDebt - totalMonthlySavings;
  const fortnightlyRemaining = monthlyToFortnightly(monthlyRemaining);

  // Category breakdown
  const categoryBreakdown = categories.map((cat) => {
    const items = activeRecurring.filter((r) => r.category_id === cat.id);
    const monthlyTotal = items.reduce((s, r) => s + r.monthly_amount, 0);
    return {
      id: cat.id,
      name: cat.name,
      color: cat.color,
      monthlyTotal,
      fortnightlyTotal: monthlyToFortnightly(monthlyTotal),
      itemCount: items.length,
    };
  });

  // This fortnight items
  const period = getCurrentPayPeriod(config);
  const thisFortnightItems = getItemsDueInPeriod(activeRecurring, period);

  // Upcoming one-offs (unpaid, future)
  const today = new Date().toISOString().slice(0, 10);
  const upcomingOneOffs = oneOffs.filter((o) => !o.is_paid && o.date >= today);

  // Holiday forecast
  const holidayForecast = holidays.reduce(
    (s, h) =>
      s + h.accommodation_cost + h.travel_cost + h.spending_budget + h.other_costs,
    0
  );

  return {
    config,
    totalMonthlyIncome,
    totalFortnightlyIncome,
    totalMonthlyExpenses,
    totalFortnightlyExpenses,
    totalMonthlyDebt,
    totalDebtBalance,
    totalBankBalance,
    totalSavingsBalance,
    totalInvestmentValue: Math.round(totalInvestmentValue * 100) / 100,
    netWorth,
    totalMonthlySavings,
    monthlyRemaining,
    fortnightlyRemaining,
    categoryBreakdown,
    thisFortnightItems,
    upcomingOneOffs,
    holidayForecast,
    incomes,
    period,
  };
}

// ── Debt payoff ─────────────────────────────────────────────────────────

export function calculateDebtPayoff(debt: {
  balance: number;
  monthly_repayment: number;
  interest_rate: number;
}) {
  const { balance, monthly_repayment, interest_rate } = debt;
  if (monthly_repayment <= 0 || balance <= 0) {
    return {
      monthsRemaining: 0,
      estimatedPayoffDate: null,
      totalInterest: 0,
      repaymentsRemaining: 0,
    };
  }

  const monthlyRate = interest_rate / 12;
  let remaining = balance;
  let totalInterest = 0;
  let months = 0;
  const maxMonths = 600; // 50 year cap

  while (remaining > 0.01 && months < maxMonths) {
    const interest = remaining * monthlyRate;
    totalInterest += interest;
    remaining = remaining + interest - monthly_repayment;
    months++;
    if (remaining > balance * 2) {
      // Payment doesn't cover interest — will never pay off
      return {
        monthsRemaining: Infinity,
        estimatedPayoffDate: null,
        totalInterest: Infinity,
        repaymentsRemaining: Infinity,
      };
    }
  }

  const payoffDate = new Date();
  payoffDate.setMonth(payoffDate.getMonth() + months);

  return {
    monthsRemaining: months,
    estimatedPayoffDate: payoffDate.toISOString().slice(0, 10),
    totalInterest: Math.round(totalInterest * 100) / 100,
    repaymentsRemaining: months,
  };
}

// ── Mortgage LVR ────────────────────────────────────────────────────────

export function calculateLVR(debt: {
  balance: number;
  property_value: number | null;
}) {
  if (!debt.property_value || debt.property_value <= 0) {
    return { lvr: 0, equity: 0, availableEquity: 0 };
  }
  const lvr = Math.round((debt.balance / debt.property_value) * 10000) / 100;
  const equity = debt.property_value - debt.balance;
  const availableEquity = Math.max(0, equity - debt.property_value * 0.2);

  return {
    lvr,
    equity: Math.round(equity * 100) / 100,
    availableEquity: Math.round(availableEquity * 100) / 100,
  };
}

// ── Holiday totals ──────────────────────────────────────────────────────

export function calculateHolidayTotal(holiday: {
  accommodation_cost: number;
  travel_cost: number;
  spending_budget: number;
  other_costs: number;
}) {
  return (
    holiday.accommodation_cost +
    holiday.travel_cost +
    holiday.spending_budget +
    holiday.other_costs
  );
}

export function getHolidayForecast(userId: string) {
  const holidays = listHolidays(userId);
  return holidays.reduce((s, h) => s + calculateHolidayTotal(h), 0);
}
