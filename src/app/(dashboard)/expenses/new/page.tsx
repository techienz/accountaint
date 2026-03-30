"use client";

import { ExpenseForm } from "@/components/expenses/expense-form";

export default function NewExpensePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Add Expense</h1>
      <ExpenseForm mode="create" />
    </div>
  );
}
