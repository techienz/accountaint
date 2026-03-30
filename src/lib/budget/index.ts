import { v4 as uuid } from "uuid";
import { getDb, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { encrypt, decrypt } from "@/lib/encryption";

// ── Config ──────────────────────────────────────────────────────────────

export function getOrCreateBudgetConfig(userId: string) {
  const db = getDb();
  const existing = db
    .select()
    .from(schema.budgetConfig)
    .where(eq(schema.budgetConfig.user_id, userId))
    .get();
  if (existing) return existing;

  const id = uuid();
  const today = new Date().toISOString().slice(0, 10);
  db.insert(schema.budgetConfig)
    .values({
      id,
      user_id: userId,
      pay_frequency: "fortnightly",
      pay_anchor_date: today,
    })
    .run();

  return db
    .select()
    .from(schema.budgetConfig)
    .where(eq(schema.budgetConfig.id, id))
    .get()!;
}

export function updateBudgetConfig(
  userId: string,
  data: { pay_frequency?: string; pay_anchor_date?: string }
) {
  const db = getDb();
  const existing = db
    .select()
    .from(schema.budgetConfig)
    .where(eq(schema.budgetConfig.user_id, userId))
    .get();
  if (!existing) return getOrCreateBudgetConfig(userId);

  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (data.pay_frequency !== undefined) updates.pay_frequency = data.pay_frequency;
  if (data.pay_anchor_date !== undefined) updates.pay_anchor_date = data.pay_anchor_date;

  db.update(schema.budgetConfig)
    .set(updates)
    .where(eq(schema.budgetConfig.user_id, userId))
    .run();

  return db
    .select()
    .from(schema.budgetConfig)
    .where(eq(schema.budgetConfig.user_id, userId))
    .get()!;
}

// ── Incomes ─────────────────────────────────────────────────────────────

type IncomeInput = {
  label: string;
  monthly_amount: number;
  work_contract_id?: string | null;
  notes?: string | null;
  is_active?: boolean;
};

export function listIncomes(userId: string) {
  const db = getDb();
  return db
    .select()
    .from(schema.budgetIncomes)
    .where(eq(schema.budgetIncomes.user_id, userId))
    .all()
    .map((r) => ({
      ...r,
      label: decrypt(r.label),
      notes: r.notes ? decrypt(r.notes) : null,
    }));
}

export function getIncome(id: string, userId: string) {
  const db = getDb();
  const row = db
    .select()
    .from(schema.budgetIncomes)
    .where(
      and(eq(schema.budgetIncomes.id, id), eq(schema.budgetIncomes.user_id, userId))
    )
    .get();
  if (!row) return null;
  return {
    ...row,
    label: decrypt(row.label),
    notes: row.notes ? decrypt(row.notes) : null,
  };
}

export function createIncome(userId: string, data: IncomeInput) {
  const db = getDb();
  const id = uuid();
  db.insert(schema.budgetIncomes)
    .values({
      id,
      user_id: userId,
      label: encrypt(data.label),
      monthly_amount: data.monthly_amount,
      work_contract_id: data.work_contract_id ?? null,
      notes: data.notes ? encrypt(data.notes) : null,
      is_active: data.is_active ?? true,
    })
    .run();
  return getIncome(id, userId);
}

export function updateIncome(id: string, userId: string, data: Partial<IncomeInput>) {
  const db = getDb();
  const existing = db
    .select()
    .from(schema.budgetIncomes)
    .where(
      and(eq(schema.budgetIncomes.id, id), eq(schema.budgetIncomes.user_id, userId))
    )
    .get();
  if (!existing) return null;

  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (data.label !== undefined) updates.label = encrypt(data.label);
  if (data.monthly_amount !== undefined) updates.monthly_amount = data.monthly_amount;
  if (data.work_contract_id !== undefined) updates.work_contract_id = data.work_contract_id;
  if (data.notes !== undefined) updates.notes = data.notes ? encrypt(data.notes) : null;
  if (data.is_active !== undefined) updates.is_active = data.is_active;

  db.update(schema.budgetIncomes)
    .set(updates)
    .where(
      and(eq(schema.budgetIncomes.id, id), eq(schema.budgetIncomes.user_id, userId))
    )
    .run();
  return getIncome(id, userId);
}

export function deleteIncome(id: string, userId: string) {
  const db = getDb();
  const result = db
    .delete(schema.budgetIncomes)
    .where(
      and(eq(schema.budgetIncomes.id, id), eq(schema.budgetIncomes.user_id, userId))
    )
    .run();
  return result.changes > 0;
}

export function getIncomeByContractId(userId: string, contractId: string) {
  const db = getDb();
  const row = db
    .select()
    .from(schema.budgetIncomes)
    .where(
      and(
        eq(schema.budgetIncomes.user_id, userId),
        eq(schema.budgetIncomes.work_contract_id, contractId)
      )
    )
    .get();
  if (!row) return null;
  return {
    ...row,
    label: decrypt(row.label),
    notes: row.notes ? decrypt(row.notes) : null,
  };
}

// ── Categories ──────────────────────────────────────────────────────────

const DEFAULT_CATEGORIES = [
  { name: "Expenses", color: "#3b82f6", sort_order: 0 },
  { name: "Subscriptions", color: "#6366f1", sort_order: 1 },
  { name: "Unplanned", color: "#f59e0b", sort_order: 2 },
  { name: "Debt", color: "#ef4444", sort_order: 3 },
  { name: "Spending", color: "#8b5cf6", sort_order: 4 },
  { name: "Savings", color: "#10b981", sort_order: 5 },
];

export function seedDefaultCategories(userId: string) {
  const db = getDb();
  const existing = db
    .select()
    .from(schema.budgetCategories)
    .where(eq(schema.budgetCategories.user_id, userId))
    .all();

  if (existing.length === 0) {
    const categories = DEFAULT_CATEGORIES.map((c) => ({
      id: uuid(),
      user_id: userId,
      ...c,
    }));
    for (const cat of categories) {
      db.insert(schema.budgetCategories).values(cat).run();
    }
    return categories;
  }

  // Add any missing default categories
  const existingNames = new Set(existing.map((c) => c.name));
  for (const def of DEFAULT_CATEGORIES) {
    if (!existingNames.has(def.name)) {
      db.insert(schema.budgetCategories)
        .values({ id: uuid(), user_id: userId, ...def })
        .run();
    }
  }

  return db
    .select()
    .from(schema.budgetCategories)
    .where(eq(schema.budgetCategories.user_id, userId))
    .all();
}

export function listCategories(userId: string) {
  const db = getDb();
  return db
    .select()
    .from(schema.budgetCategories)
    .where(eq(schema.budgetCategories.user_id, userId))
    .all()
    .sort((a, b) => a.sort_order - b.sort_order);
}

export function createCategory(
  userId: string,
  data: { name: string; color?: string | null; sort_order?: number }
) {
  const db = getDb();
  const id = uuid();
  db.insert(schema.budgetCategories)
    .values({
      id,
      user_id: userId,
      name: data.name,
      color: data.color ?? null,
      sort_order: data.sort_order ?? 0,
    })
    .run();
  return db
    .select()
    .from(schema.budgetCategories)
    .where(eq(schema.budgetCategories.id, id))
    .get()!;
}

export function updateCategory(
  id: string,
  userId: string,
  data: { name?: string; color?: string | null; sort_order?: number }
) {
  const db = getDb();
  const existing = db
    .select()
    .from(schema.budgetCategories)
    .where(
      and(
        eq(schema.budgetCategories.id, id),
        eq(schema.budgetCategories.user_id, userId)
      )
    )
    .get();
  if (!existing) return null;

  const updates: Record<string, unknown> = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.color !== undefined) updates.color = data.color;
  if (data.sort_order !== undefined) updates.sort_order = data.sort_order;

  db.update(schema.budgetCategories)
    .set(updates)
    .where(
      and(
        eq(schema.budgetCategories.id, id),
        eq(schema.budgetCategories.user_id, userId)
      )
    )
    .run();
  return db
    .select()
    .from(schema.budgetCategories)
    .where(eq(schema.budgetCategories.id, id))
    .get()!;
}

export function deleteCategory(id: string, userId: string) {
  const db = getDb();
  const result = db
    .delete(schema.budgetCategories)
    .where(
      and(
        eq(schema.budgetCategories.id, id),
        eq(schema.budgetCategories.user_id, userId)
      )
    )
    .run();
  return result.changes > 0;
}

// ── Recurring Items ─────────────────────────────────────────────────────

type RecurringInput = {
  category_id?: string | null;
  name: string;
  notes?: string | null;
  monthly_amount: number;
  due_day?: number | null;
  frequency?: string;
  is_debt?: boolean;
  debt_principal_portion?: number | null;
  is_active?: boolean;
};

export function listRecurringItems(userId: string) {
  const db = getDb();
  return db
    .select()
    .from(schema.budgetRecurringItems)
    .where(eq(schema.budgetRecurringItems.user_id, userId))
    .all()
    .map((r) => ({
      ...r,
      name: decrypt(r.name),
      notes: r.notes ? decrypt(r.notes) : null,
    }));
}

export function getRecurringItem(id: string, userId: string) {
  const db = getDb();
  const row = db
    .select()
    .from(schema.budgetRecurringItems)
    .where(
      and(
        eq(schema.budgetRecurringItems.id, id),
        eq(schema.budgetRecurringItems.user_id, userId)
      )
    )
    .get();
  if (!row) return null;
  return {
    ...row,
    name: decrypt(row.name),
    notes: row.notes ? decrypt(row.notes) : null,
  };
}

export function createRecurringItem(userId: string, data: RecurringInput) {
  const db = getDb();
  const id = uuid();
  db.insert(schema.budgetRecurringItems)
    .values({
      id,
      user_id: userId,
      category_id: data.category_id ?? null,
      name: encrypt(data.name),
      notes: data.notes ? encrypt(data.notes) : null,
      monthly_amount: data.monthly_amount,
      due_day: data.due_day ?? null,
      frequency: (data.frequency as "weekly" | "fortnightly" | "monthly" | "quarterly" | "annually") ?? "monthly",
      is_debt: data.is_debt ?? false,
      debt_principal_portion: data.debt_principal_portion ?? null,
      is_active: data.is_active ?? true,
    })
    .run();
  return getRecurringItem(id, userId);
}

export function updateRecurringItem(
  id: string,
  userId: string,
  data: Partial<RecurringInput>
) {
  const db = getDb();
  const existing = db
    .select()
    .from(schema.budgetRecurringItems)
    .where(
      and(
        eq(schema.budgetRecurringItems.id, id),
        eq(schema.budgetRecurringItems.user_id, userId)
      )
    )
    .get();
  if (!existing) return null;

  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (data.category_id !== undefined) updates.category_id = data.category_id;
  if (data.name !== undefined) updates.name = encrypt(data.name);
  if (data.notes !== undefined) updates.notes = data.notes ? encrypt(data.notes) : null;
  if (data.monthly_amount !== undefined) updates.monthly_amount = data.monthly_amount;
  if (data.due_day !== undefined) updates.due_day = data.due_day;
  if (data.frequency !== undefined) updates.frequency = data.frequency;
  if (data.is_debt !== undefined) updates.is_debt = data.is_debt;
  if (data.debt_principal_portion !== undefined)
    updates.debt_principal_portion = data.debt_principal_portion;
  if (data.is_active !== undefined) updates.is_active = data.is_active;

  db.update(schema.budgetRecurringItems)
    .set(updates)
    .where(
      and(
        eq(schema.budgetRecurringItems.id, id),
        eq(schema.budgetRecurringItems.user_id, userId)
      )
    )
    .run();
  return getRecurringItem(id, userId);
}

export function deleteRecurringItem(id: string, userId: string) {
  const db = getDb();
  const result = db
    .delete(schema.budgetRecurringItems)
    .where(
      and(
        eq(schema.budgetRecurringItems.id, id),
        eq(schema.budgetRecurringItems.user_id, userId)
      )
    )
    .run();
  return result.changes > 0;
}

// ── One-Off Expenses ────────────────────────────────────────────────────

type OneOffInput = {
  category_id?: string | null;
  name: string;
  notes?: string | null;
  amount: number;
  date: string;
  is_paid?: boolean;
};

export function listOneOffExpenses(userId: string) {
  const db = getDb();
  return db
    .select()
    .from(schema.budgetOneOffExpenses)
    .where(eq(schema.budgetOneOffExpenses.user_id, userId))
    .all()
    .map((r) => ({
      ...r,
      name: decrypt(r.name),
      notes: r.notes ? decrypt(r.notes) : null,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function getOneOffExpense(id: string, userId: string) {
  const db = getDb();
  const row = db
    .select()
    .from(schema.budgetOneOffExpenses)
    .where(
      and(
        eq(schema.budgetOneOffExpenses.id, id),
        eq(schema.budgetOneOffExpenses.user_id, userId)
      )
    )
    .get();
  if (!row) return null;
  return {
    ...row,
    name: decrypt(row.name),
    notes: row.notes ? decrypt(row.notes) : null,
  };
}

export function createOneOffExpense(userId: string, data: OneOffInput) {
  const db = getDb();
  const id = uuid();
  db.insert(schema.budgetOneOffExpenses)
    .values({
      id,
      user_id: userId,
      category_id: data.category_id ?? null,
      name: encrypt(data.name),
      notes: data.notes ? encrypt(data.notes) : null,
      amount: data.amount,
      date: data.date,
      is_paid: data.is_paid ?? false,
    })
    .run();
  return getOneOffExpense(id, userId);
}

export function updateOneOffExpense(
  id: string,
  userId: string,
  data: Partial<OneOffInput>
) {
  const db = getDb();
  const existing = db
    .select()
    .from(schema.budgetOneOffExpenses)
    .where(
      and(
        eq(schema.budgetOneOffExpenses.id, id),
        eq(schema.budgetOneOffExpenses.user_id, userId)
      )
    )
    .get();
  if (!existing) return null;

  const updates: Record<string, unknown> = {};
  if (data.category_id !== undefined) updates.category_id = data.category_id;
  if (data.name !== undefined) updates.name = encrypt(data.name);
  if (data.notes !== undefined) updates.notes = data.notes ? encrypt(data.notes) : null;
  if (data.amount !== undefined) updates.amount = data.amount;
  if (data.date !== undefined) updates.date = data.date;
  if (data.is_paid !== undefined) updates.is_paid = data.is_paid;

  db.update(schema.budgetOneOffExpenses)
    .set(updates)
    .where(
      and(
        eq(schema.budgetOneOffExpenses.id, id),
        eq(schema.budgetOneOffExpenses.user_id, userId)
      )
    )
    .run();
  return getOneOffExpense(id, userId);
}

export function deleteOneOffExpense(id: string, userId: string) {
  const db = getDb();
  const result = db
    .delete(schema.budgetOneOffExpenses)
    .where(
      and(
        eq(schema.budgetOneOffExpenses.id, id),
        eq(schema.budgetOneOffExpenses.user_id, userId)
      )
    )
    .run();
  return result.changes > 0;
}

// ── Debts ───────────────────────────────────────────────────────────────

type DebtInput = {
  name: string;
  balance: number;
  monthly_repayment: number;
  interest_rate: number;
  is_mortgage?: boolean;
  is_credit_card?: boolean;
  credit_limit?: number | null;
  property_value?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  minimum_payment?: number | null;
  notes?: string | null;
  status?: string;
};

export function listDebts(userId: string) {
  const db = getDb();
  return db
    .select()
    .from(schema.budgetDebts)
    .where(eq(schema.budgetDebts.user_id, userId))
    .all()
    .map((r) => ({
      ...r,
      name: decrypt(r.name),
      notes: r.notes ? decrypt(r.notes) : null,
    }));
}

export function getDebt(id: string, userId: string) {
  const db = getDb();
  const row = db
    .select()
    .from(schema.budgetDebts)
    .where(
      and(eq(schema.budgetDebts.id, id), eq(schema.budgetDebts.user_id, userId))
    )
    .get();
  if (!row) return null;
  return {
    ...row,
    name: decrypt(row.name),
    notes: row.notes ? decrypt(row.notes) : null,
  };
}

export function createDebt(userId: string, data: DebtInput) {
  const db = getDb();
  const id = uuid();
  db.insert(schema.budgetDebts)
    .values({
      id,
      user_id: userId,
      name: encrypt(data.name),
      balance: data.balance,
      monthly_repayment: data.monthly_repayment,
      interest_rate: data.interest_rate,
      is_mortgage: data.is_mortgage ?? false,
      is_credit_card: data.is_credit_card ?? false,
      credit_limit: data.credit_limit ?? null,
      property_value: data.property_value ?? null,
      start_date: data.start_date ?? null,
      end_date: data.end_date ?? null,
      minimum_payment: data.minimum_payment ?? null,
      notes: data.notes ? encrypt(data.notes) : null,
      status: (data.status as "active" | "paid_off") ?? "active",
    })
    .run();
  return getDebt(id, userId);
}

export function updateDebt(id: string, userId: string, data: Partial<DebtInput>) {
  const db = getDb();
  const existing = db
    .select()
    .from(schema.budgetDebts)
    .where(
      and(eq(schema.budgetDebts.id, id), eq(schema.budgetDebts.user_id, userId))
    )
    .get();
  if (!existing) return null;

  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (data.name !== undefined) updates.name = encrypt(data.name);
  if (data.balance !== undefined) updates.balance = data.balance;
  if (data.monthly_repayment !== undefined)
    updates.monthly_repayment = data.monthly_repayment;
  if (data.interest_rate !== undefined) updates.interest_rate = data.interest_rate;
  if (data.is_mortgage !== undefined) updates.is_mortgage = data.is_mortgage;
  if (data.is_credit_card !== undefined) updates.is_credit_card = data.is_credit_card;
  if (data.credit_limit !== undefined) updates.credit_limit = data.credit_limit;
  if (data.property_value !== undefined) updates.property_value = data.property_value;
  if (data.start_date !== undefined) updates.start_date = data.start_date;
  if (data.end_date !== undefined) updates.end_date = data.end_date;
  if (data.minimum_payment !== undefined) updates.minimum_payment = data.minimum_payment;
  if (data.notes !== undefined) updates.notes = data.notes ? encrypt(data.notes) : null;
  if (data.status !== undefined) updates.status = data.status;

  db.update(schema.budgetDebts)
    .set(updates)
    .where(
      and(eq(schema.budgetDebts.id, id), eq(schema.budgetDebts.user_id, userId))
    )
    .run();
  return getDebt(id, userId);
}

export function deleteDebt(id: string, userId: string) {
  const db = getDb();
  const result = db
    .delete(schema.budgetDebts)
    .where(
      and(eq(schema.budgetDebts.id, id), eq(schema.budgetDebts.user_id, userId))
    )
    .run();
  return result.changes > 0;
}

// ── Savings Goals ───────────────────────────────────────────────────────

type SavingsInput = {
  name: string;
  current_balance?: number;
  target_amount?: number | null;
  fortnightly_contribution?: number;
  notes?: string | null;
  status?: string;
};

export function listSavingsGoals(userId: string) {
  const db = getDb();
  return db
    .select()
    .from(schema.budgetSavingsGoals)
    .where(eq(schema.budgetSavingsGoals.user_id, userId))
    .all()
    .map((r) => ({
      ...r,
      name: decrypt(r.name),
      notes: r.notes ? decrypt(r.notes) : null,
    }));
}

export function getSavingsGoal(id: string, userId: string) {
  const db = getDb();
  const row = db
    .select()
    .from(schema.budgetSavingsGoals)
    .where(
      and(
        eq(schema.budgetSavingsGoals.id, id),
        eq(schema.budgetSavingsGoals.user_id, userId)
      )
    )
    .get();
  if (!row) return null;
  return {
    ...row,
    name: decrypt(row.name),
    notes: row.notes ? decrypt(row.notes) : null,
  };
}

export function createSavingsGoal(userId: string, data: SavingsInput) {
  const db = getDb();
  const id = uuid();
  db.insert(schema.budgetSavingsGoals)
    .values({
      id,
      user_id: userId,
      name: encrypt(data.name),
      current_balance: data.current_balance ?? 0,
      target_amount: data.target_amount ?? null,
      fortnightly_contribution: data.fortnightly_contribution ?? 0,
      notes: data.notes ? encrypt(data.notes) : null,
      status: (data.status as "active" | "reached" | "paused") ?? "active",
    })
    .run();
  return getSavingsGoal(id, userId);
}

export function updateSavingsGoal(
  id: string,
  userId: string,
  data: Partial<SavingsInput>
) {
  const db = getDb();
  const existing = db
    .select()
    .from(schema.budgetSavingsGoals)
    .where(
      and(
        eq(schema.budgetSavingsGoals.id, id),
        eq(schema.budgetSavingsGoals.user_id, userId)
      )
    )
    .get();
  if (!existing) return null;

  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (data.name !== undefined) updates.name = encrypt(data.name);
  if (data.current_balance !== undefined) updates.current_balance = data.current_balance;
  if (data.target_amount !== undefined) updates.target_amount = data.target_amount;
  if (data.fortnightly_contribution !== undefined)
    updates.fortnightly_contribution = data.fortnightly_contribution;
  if (data.notes !== undefined) updates.notes = data.notes ? encrypt(data.notes) : null;
  if (data.status !== undefined) updates.status = data.status;

  db.update(schema.budgetSavingsGoals)
    .set(updates)
    .where(
      and(
        eq(schema.budgetSavingsGoals.id, id),
        eq(schema.budgetSavingsGoals.user_id, userId)
      )
    )
    .run();
  return getSavingsGoal(id, userId);
}

export function deleteSavingsGoal(id: string, userId: string) {
  const db = getDb();
  const result = db
    .delete(schema.budgetSavingsGoals)
    .where(
      and(
        eq(schema.budgetSavingsGoals.id, id),
        eq(schema.budgetSavingsGoals.user_id, userId)
      )
    )
    .run();
  return result.changes > 0;
}

// ── Holidays ────────────────────────────────────────────────────────────

type HolidayInput = {
  savings_goal_id?: string | null;
  destination: string;
  date?: string | null;
  year?: number | null;
  accommodation_cost?: number;
  travel_cost?: number;
  spending_budget?: number;
  other_costs?: number;
  trip_type?: string;
  notes?: string | null;
  custom_fields?: string | null; // JSON [{label, value}]
};

export function listHolidays(userId: string) {
  const db = getDb();
  return db
    .select()
    .from(schema.budgetHolidays)
    .where(eq(schema.budgetHolidays.user_id, userId))
    .all()
    .map((r) => ({
      ...r,
      destination: decrypt(r.destination),
      notes: r.notes ? decrypt(r.notes) : null,
    }))
    .sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999));
}

export function getHoliday(id: string, userId: string) {
  const db = getDb();
  const row = db
    .select()
    .from(schema.budgetHolidays)
    .where(
      and(
        eq(schema.budgetHolidays.id, id),
        eq(schema.budgetHolidays.user_id, userId)
      )
    )
    .get();
  if (!row) return null;
  return {
    ...row,
    destination: decrypt(row.destination),
    notes: row.notes ? decrypt(row.notes) : null,
  };
}

export function createHoliday(userId: string, data: HolidayInput) {
  const db = getDb();
  const id = uuid();
  db.insert(schema.budgetHolidays)
    .values({
      id,
      user_id: userId,
      savings_goal_id: data.savings_goal_id ?? null,
      destination: encrypt(data.destination),
      date: data.date ?? null,
      year: data.year ?? null,
      accommodation_cost: data.accommodation_cost ?? 0,
      travel_cost: data.travel_cost ?? 0,
      spending_budget: data.spending_budget ?? 0,
      other_costs: data.other_costs ?? 0,
      trip_type: (data.trip_type as "domestic" | "international") ?? "domestic",
      notes: data.notes ? encrypt(data.notes) : null,
      custom_fields: data.custom_fields ?? null,
    })
    .run();
  return getHoliday(id, userId);
}

export function updateHoliday(
  id: string,
  userId: string,
  data: Partial<HolidayInput>
) {
  const db = getDb();
  const existing = db
    .select()
    .from(schema.budgetHolidays)
    .where(
      and(
        eq(schema.budgetHolidays.id, id),
        eq(schema.budgetHolidays.user_id, userId)
      )
    )
    .get();
  if (!existing) return null;

  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (data.savings_goal_id !== undefined) updates.savings_goal_id = data.savings_goal_id;
  if (data.destination !== undefined) updates.destination = encrypt(data.destination);
  if (data.date !== undefined) updates.date = data.date;
  if (data.year !== undefined) updates.year = data.year;
  if (data.accommodation_cost !== undefined)
    updates.accommodation_cost = data.accommodation_cost;
  if (data.travel_cost !== undefined) updates.travel_cost = data.travel_cost;
  if (data.spending_budget !== undefined) updates.spending_budget = data.spending_budget;
  if (data.other_costs !== undefined) updates.other_costs = data.other_costs;
  if (data.trip_type !== undefined) updates.trip_type = data.trip_type;
  if (data.notes !== undefined) updates.notes = data.notes ? encrypt(data.notes) : null;
  if (data.custom_fields !== undefined) updates.custom_fields = data.custom_fields;

  db.update(schema.budgetHolidays)
    .set(updates)
    .where(
      and(
        eq(schema.budgetHolidays.id, id),
        eq(schema.budgetHolidays.user_id, userId)
      )
    )
    .run();
  return getHoliday(id, userId);
}

export function deleteHoliday(id: string, userId: string) {
  const db = getDb();
  const result = db
    .delete(schema.budgetHolidays)
    .where(
      and(
        eq(schema.budgetHolidays.id, id),
        eq(schema.budgetHolidays.user_id, userId)
      )
    )
    .run();
  return result.changes > 0;
}

// ── Holiday Attachments ─────────────────────────────────────────────

export function listHolidayAttachments(holidayId: string, userId: string) {
  const db = getDb();
  return db
    .select()
    .from(schema.budgetHolidayAttachments)
    .where(
      and(
        eq(schema.budgetHolidayAttachments.holiday_id, holidayId),
        eq(schema.budgetHolidayAttachments.user_id, userId)
      )
    )
    .all()
    .map((r) => ({
      ...r,
      name: decrypt(r.name),
    }));
}

export function createHolidayAttachment(
  userId: string,
  data: { holiday_id: string; name: string; type: "link" | "file"; url?: string; file_path?: string }
) {
  const db = getDb();
  const id = uuid();
  db.insert(schema.budgetHolidayAttachments)
    .values({
      id,
      holiday_id: data.holiday_id,
      user_id: userId,
      name: encrypt(data.name),
      type: data.type,
      url: data.url ?? null,
      file_path: data.file_path ?? null,
    })
    .run();
  return db
    .select()
    .from(schema.budgetHolidayAttachments)
    .where(eq(schema.budgetHolidayAttachments.id, id))
    .get()!;
}

export function deleteHolidayAttachment(id: string, userId: string) {
  const db = getDb();
  const result = db
    .delete(schema.budgetHolidayAttachments)
    .where(
      and(
        eq(schema.budgetHolidayAttachments.id, id),
        eq(schema.budgetHolidayAttachments.user_id, userId)
      )
    )
    .run();
  return result.changes > 0;
}

// ── Bank Accounts ───────────────────────────────────────────────────

type BankAccountInput = {
  name: string;
  institution?: string | null;
  account_type?: string;
  balance?: number;
  notes?: string | null;
  is_active?: boolean;
};

export function listBankAccounts(userId: string) {
  const db = getDb();
  return db
    .select()
    .from(schema.budgetBankAccounts)
    .where(eq(schema.budgetBankAccounts.user_id, userId))
    .all()
    .map((r) => ({
      ...r,
      name: decrypt(r.name),
      institution: r.institution ? decrypt(r.institution) : null,
      notes: r.notes ? decrypt(r.notes) : null,
    }));
}

export function getBankAccount(id: string, userId: string) {
  const db = getDb();
  const row = db
    .select()
    .from(schema.budgetBankAccounts)
    .where(
      and(eq(schema.budgetBankAccounts.id, id), eq(schema.budgetBankAccounts.user_id, userId))
    )
    .get();
  if (!row) return null;
  return {
    ...row,
    name: decrypt(row.name),
    institution: row.institution ? decrypt(row.institution) : null,
    notes: row.notes ? decrypt(row.notes) : null,
  };
}

export function createBankAccount(userId: string, data: BankAccountInput) {
  const db = getDb();
  const id = uuid();
  db.insert(schema.budgetBankAccounts)
    .values({
      id,
      user_id: userId,
      name: encrypt(data.name),
      institution: data.institution ? encrypt(data.institution) : null,
      account_type: (data.account_type as "everyday" | "savings" | "term_deposit" | "investment" | "other") ?? "everyday",
      balance: data.balance ?? 0,
      notes: data.notes ? encrypt(data.notes) : null,
      is_active: data.is_active ?? true,
    })
    .run();
  return getBankAccount(id, userId);
}

export function updateBankAccount(id: string, userId: string, data: Partial<BankAccountInput>) {
  const db = getDb();
  const existing = db
    .select()
    .from(schema.budgetBankAccounts)
    .where(
      and(eq(schema.budgetBankAccounts.id, id), eq(schema.budgetBankAccounts.user_id, userId))
    )
    .get();
  if (!existing) return null;

  const updates: Record<string, unknown> = { last_updated: new Date() };
  if (data.name !== undefined) updates.name = encrypt(data.name);
  if (data.institution !== undefined) updates.institution = data.institution ? encrypt(data.institution) : null;
  if (data.account_type !== undefined) updates.account_type = data.account_type;
  if (data.balance !== undefined) updates.balance = data.balance;
  if (data.notes !== undefined) updates.notes = data.notes ? encrypt(data.notes) : null;
  if (data.is_active !== undefined) updates.is_active = data.is_active;

  db.update(schema.budgetBankAccounts)
    .set(updates)
    .where(
      and(eq(schema.budgetBankAccounts.id, id), eq(schema.budgetBankAccounts.user_id, userId))
    )
    .run();
  return getBankAccount(id, userId);
}

export function deleteBankAccount(id: string, userId: string) {
  const db = getDb();
  const result = db
    .delete(schema.budgetBankAccounts)
    .where(
      and(eq(schema.budgetBankAccounts.id, id), eq(schema.budgetBankAccounts.user_id, userId))
    )
    .run();
  return result.changes > 0;
}

// ── Investments ─────────────────────────────────────────────────────

type InvestmentInput = {
  name: string;
  type: string;
  platform?: string | null;
  units?: number | null;
  cost_basis: number;
  current_value: number;
  currency?: string;
  nzd_rate?: number;
  purchase_date?: string | null;
  notes?: string | null;
  status?: string;
};

export function listInvestments(userId: string) {
  const db = getDb();
  return db
    .select()
    .from(schema.budgetInvestments)
    .where(eq(schema.budgetInvestments.user_id, userId))
    .all()
    .map((r) => ({
      ...r,
      name: decrypt(r.name),
      platform: r.platform ? decrypt(r.platform) : null,
      notes: r.notes ? decrypt(r.notes) : null,
    }));
}

export function getInvestment(id: string, userId: string) {
  const db = getDb();
  const row = db
    .select()
    .from(schema.budgetInvestments)
    .where(
      and(
        eq(schema.budgetInvestments.id, id),
        eq(schema.budgetInvestments.user_id, userId)
      )
    )
    .get();
  if (!row) return null;
  return {
    ...row,
    name: decrypt(row.name),
    platform: row.platform ? decrypt(row.platform) : null,
    notes: row.notes ? decrypt(row.notes) : null,
  };
}

export function createInvestment(userId: string, data: InvestmentInput) {
  const db = getDb();
  const id = uuid();
  const nzdRate = data.nzd_rate ?? 1;
  db.insert(schema.budgetInvestments)
    .values({
      id,
      user_id: userId,
      name: encrypt(data.name),
      type: data.type as "shares" | "kiwisaver" | "term_deposit" | "managed_fund" | "crypto" | "property" | "other",
      platform: data.platform ? encrypt(data.platform) : null,
      units: data.units ?? null,
      cost_basis: data.cost_basis,
      current_value: data.current_value,
      currency: (data.currency as "NZD" | "AUD" | "USD") ?? "NZD",
      nzd_rate: nzdRate,
      purchase_date: data.purchase_date ?? null,
      notes: data.notes ? encrypt(data.notes) : null,
      status: (data.status as "active" | "sold") ?? "active",
    })
    .run();

  // Insert initial value history row
  db.insert(schema.budgetInvestmentValueHistory)
    .values({
      id: uuid(),
      investment_id: id,
      user_id: userId,
      value: data.current_value,
      nzd_rate: nzdRate,
    })
    .run();

  return getInvestment(id, userId);
}

export function updateInvestment(
  id: string,
  userId: string,
  data: Partial<InvestmentInput>
) {
  const db = getDb();
  const existing = db
    .select()
    .from(schema.budgetInvestments)
    .where(
      and(
        eq(schema.budgetInvestments.id, id),
        eq(schema.budgetInvestments.user_id, userId)
      )
    )
    .get();
  if (!existing) return null;

  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (data.name !== undefined) updates.name = encrypt(data.name);
  if (data.type !== undefined) updates.type = data.type;
  if (data.platform !== undefined)
    updates.platform = data.platform ? encrypt(data.platform) : null;
  if (data.units !== undefined) updates.units = data.units;
  if (data.cost_basis !== undefined) updates.cost_basis = data.cost_basis;
  if (data.current_value !== undefined) updates.current_value = data.current_value;
  if (data.currency !== undefined) updates.currency = data.currency;
  if (data.nzd_rate !== undefined) updates.nzd_rate = data.nzd_rate;
  if (data.purchase_date !== undefined) updates.purchase_date = data.purchase_date;
  if (data.notes !== undefined)
    updates.notes = data.notes ? encrypt(data.notes) : null;
  if (data.status !== undefined) updates.status = data.status;

  db.update(schema.budgetInvestments)
    .set(updates)
    .where(
      and(
        eq(schema.budgetInvestments.id, id),
        eq(schema.budgetInvestments.user_id, userId)
      )
    )
    .run();

  // Auto-insert history row when current_value changes
  if (
    data.current_value !== undefined &&
    data.current_value !== existing.current_value
  ) {
    db.insert(schema.budgetInvestmentValueHistory)
      .values({
        id: uuid(),
        investment_id: id,
        user_id: userId,
        value: data.current_value,
        nzd_rate: data.nzd_rate ?? existing.nzd_rate,
      })
      .run();
  }

  return getInvestment(id, userId);
}

export function deleteInvestment(id: string, userId: string) {
  const db = getDb();
  const result = db
    .delete(schema.budgetInvestments)
    .where(
      and(
        eq(schema.budgetInvestments.id, id),
        eq(schema.budgetInvestments.user_id, userId)
      )
    )
    .run();
  return result.changes > 0;
}

export function listInvestmentValueHistory(investmentId: string, userId: string) {
  const db = getDb();
  return db
    .select()
    .from(schema.budgetInvestmentValueHistory)
    .where(
      and(
        eq(schema.budgetInvestmentValueHistory.investment_id, investmentId),
        eq(schema.budgetInvestmentValueHistory.user_id, userId)
      )
    )
    .all()
    .sort(
      (a, b) =>
        (a.recorded_at?.getTime() ?? 0) - (b.recorded_at?.getTime() ?? 0)
    );
}
