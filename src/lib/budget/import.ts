import * as XLSX from "xlsx";
import {
  createIncome,
  createRecurringItem,
  createOneOffExpense,
  createDebt,
  createSavingsGoal,
  createHoliday,
  seedDefaultCategories,
  listCategories,
} from "./index";

type ParsedBudget = {
  incomes: { label: string; monthly_amount: number }[];
  recurring: {
    name: string;
    monthly_amount: number;
    due_day: number | null;
    frequency: string;
    category: string;
  }[];
  oneOffs: { name: string; amount: number; date: string }[];
  debts: {
    name: string;
    balance: number;
    monthly_repayment: number;
    interest_rate: number;
    is_mortgage: boolean;
    property_value: number | null;
  }[];
  savings: {
    name: string;
    current_balance: number;
    target_amount: number | null;
    fortnightly_contribution: number;
  }[];
  holidays: {
    destination: string;
    year: number | null;
    accommodation_cost: number;
    travel_cost: number;
    spending_budget: number;
    other_costs: number;
    trip_type: string;
  }[];
};

function findSheet(
  workbook: XLSX.WorkBook,
  names: string[]
): XLSX.WorkSheet | null {
  for (const name of names) {
    const lower = name.toLowerCase();
    const match = workbook.SheetNames.find(
      (s) => s.toLowerCase().includes(lower)
    );
    if (match) return workbook.Sheets[match];
  }
  return null;
}

function cellVal(sheet: XLSX.WorkSheet, cell: string): unknown {
  const c = sheet[cell];
  return c ? c.v : null;
}

function sheetToRows(sheet: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
}

function isNumber(v: unknown): v is number {
  return typeof v === "number" && !isNaN(v);
}

export function parseSpreadsheet(buffer: Buffer): ParsedBudget {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const result: ParsedBudget = {
    incomes: [],
    recurring: [],
    oneOffs: [],
    debts: [],
    savings: [],
    holidays: [],
  };

  // Parse Overview tab for incomes
  const overview = findSheet(workbook, ["overview"]);
  if (overview) {
    const rows = sheetToRows(overview);
    for (const row of rows) {
      const label = String(row[0] ?? "").trim();
      if (
        label.toLowerCase().includes("person") ||
        label.toLowerCase().includes("income")
      ) {
        const amount = row[1];
        if (isNumber(amount) && amount > 0) {
          result.incomes.push({ label, monthly_amount: amount });
        }
      }
    }
  }

  // Parse Expenses tab
  const expenses = findSheet(workbook, ["expenses", "expense"]);
  if (expenses) {
    const rows = sheetToRows(expenses);
    // Find header row
    let headerIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const row = rows[i];
      if (!row) continue;
      const rowStr = row.map((c) => String(c ?? "").toLowerCase()).join(" ");
      if (
        rowStr.includes("monthly") ||
        rowStr.includes("amount") ||
        rowStr.includes("due")
      ) {
        headerIdx = i;
        break;
      }
    }

    if (headerIdx >= 0) {
      const headers = (rows[headerIdx] ?? []).map((h) =>
        String(h ?? "").toLowerCase().trim()
      );
      const nameCol = headers.findIndex(
        (h) => h.includes("name") || h.includes("item") || h === ""
      );
      const monthlyCol = headers.findIndex((h) => h.includes("monthly"));
      const dueDayCol = headers.findIndex((h) => h.includes("due"));
      const freqCol = headers.findIndex((h) => h.includes("freq"));

      for (let i = headerIdx + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;
        const name = String(row[nameCol >= 0 ? nameCol : 0] ?? "").trim();
        if (!name) continue;
        const monthly = row[monthlyCol >= 0 ? monthlyCol : 1];
        if (!isNumber(monthly) || monthly <= 0) continue;

        const dueDay = dueDayCol >= 0 ? row[dueDayCol] : null;
        const freq = freqCol >= 0 ? String(row[freqCol] ?? "monthly").toLowerCase() : "monthly";

        result.recurring.push({
          name,
          monthly_amount: monthly,
          due_day: isNumber(dueDay) && dueDay >= 1 && dueDay <= 28 ? dueDay : null,
          frequency: freq.includes("annual") ? "annually" : freq.includes("quarter") ? "quarterly" : "monthly",
          category: "Expenses",
        });
      }
    }
  }

  // Parse Savings/Debt/Pay tab
  const savingsDebt = findSheet(workbook, [
    "savings debt",
    "debt",
    "savings",
    "pay",
  ]);
  if (savingsDebt) {
    const rows = sheetToRows(savingsDebt);
    let section = "";

    for (const row of rows) {
      if (!row || row.length === 0) continue;
      const first = String(row[0] ?? "").trim().toLowerCase();

      // Detect section headers
      if (first.includes("debt") && !first.includes("savings")) {
        section = "debt";
        continue;
      }
      if (first.includes("mortgage")) {
        section = "mortgage";
      }
      if (first.includes("saving") || first.includes("goal")) {
        section = "savings";
        continue;
      }

      const name = String(row[0] ?? "").trim();
      if (!name) continue;

      if (section === "debt" || section === "mortgage") {
        const balance = row[1];
        const repayment = row[2];
        const rate = row[3];
        if (isNumber(balance) && balance > 0) {
          result.debts.push({
            name,
            balance,
            monthly_repayment: isNumber(repayment) ? repayment : 0,
            interest_rate: isNumber(rate) ? (rate > 1 ? rate / 100 : rate) : 0,
            is_mortgage: section === "mortgage" || first.includes("mortgage"),
            property_value: section === "mortgage" && isNumber(row[4]) ? row[4] : null,
          });
        }
      } else if (section === "savings") {
        const balance = row[1];
        const target = row[2];
        const contribution = row[3];
        if (isNumber(balance) || isNumber(contribution)) {
          result.savings.push({
            name,
            current_balance: isNumber(balance) ? balance : 0,
            target_amount: isNumber(target) && target > 0 ? target : null,
            fortnightly_contribution: isNumber(contribution) ? contribution : 0,
          });
        }
      }
    }
  }

  // Parse Holidays tab
  const holidays = findSheet(workbook, ["holiday", "trip", "travel"]);
  if (holidays) {
    const rows = sheetToRows(holidays);
    let headerIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const row = rows[i];
      if (!row) continue;
      const rowStr = row.map((c) => String(c ?? "").toLowerCase()).join(" ");
      if (
        rowStr.includes("destination") ||
        rowStr.includes("accommodation") ||
        rowStr.includes("travel")
      ) {
        headerIdx = i;
        break;
      }
    }

    if (headerIdx >= 0) {
      const headers = (rows[headerIdx] ?? []).map((h) =>
        String(h ?? "").toLowerCase().trim()
      );
      const destCol = headers.findIndex(
        (h) => h.includes("destination") || h.includes("trip") || h === ""
      );
      const yearCol = headers.findIndex((h) => h.includes("year"));
      const accomCol = headers.findIndex((h) => h.includes("accom"));
      const travelCol = headers.findIndex((h) => h.includes("travel") || h.includes("flight"));
      const spendCol = headers.findIndex((h) => h.includes("spend"));
      const otherCol = headers.findIndex((h) => h.includes("other"));

      for (let i = headerIdx + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;
        const dest = String(row[destCol >= 0 ? destCol : 0] ?? "").trim();
        if (!dest) continue;

        const year = yearCol >= 0 && isNumber(row[yearCol]) ? row[yearCol] : null;
        const accom = accomCol >= 0 && isNumber(row[accomCol]) ? row[accomCol] : 0;
        const travel = travelCol >= 0 && isNumber(row[travelCol]) ? row[travelCol] : 0;
        const spend = spendCol >= 0 && isNumber(row[spendCol]) ? row[spendCol] : 0;
        const other = otherCol >= 0 && isNumber(row[otherCol]) ? row[otherCol] : 0;

        if (accom + travel + spend + other > 0) {
          result.holidays.push({
            destination: dest,
            year,
            accommodation_cost: accom,
            travel_cost: travel,
            spending_budget: spend,
            other_costs: other,
            trip_type: "domestic",
          });
        }
      }
    }
  }

  return result;
}

export function importBudgetFromExcel(userId: string, buffer: Buffer) {
  const parsed = parseSpreadsheet(buffer);

  // Seed categories
  seedDefaultCategories(userId);
  const categories = listCategories(userId);
  const catMap = new Map(categories.map((c) => [c.name, c.id]));

  const counts = {
    incomes: 0,
    recurring: 0,
    oneOffs: 0,
    debts: 0,
    savings: 0,
    holidays: 0,
  };

  for (const inc of parsed.incomes) {
    createIncome(userId, inc);
    counts.incomes++;
  }

  for (const rec of parsed.recurring) {
    createRecurringItem(userId, {
      ...rec,
      category_id: catMap.get(rec.category) ?? null,
    });
    counts.recurring++;
  }

  for (const oo of parsed.oneOffs) {
    createOneOffExpense(userId, oo);
    counts.oneOffs++;
  }

  for (const debt of parsed.debts) {
    createDebt(userId, debt);
    counts.debts++;
  }

  for (const sav of parsed.savings) {
    createSavingsGoal(userId, sav);
    counts.savings++;
  }

  for (const hol of parsed.holidays) {
    createHoliday(userId, hol);
    counts.holidays++;
  }

  return { parsed, counts };
}
