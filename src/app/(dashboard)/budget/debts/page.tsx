"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DebtPayoffCard } from "@/components/budget/debt-payoff-card";
import { Plus } from "lucide-react";

type Debt = {
  id: string;
  name: string;
  balance: number;
  monthly_repayment: number;
  interest_rate: number;
  is_mortgage: boolean;
  is_credit_card: boolean;
  credit_limit: number | null;
  property_value: number | null;
  start_date: string | null;
  end_date: string | null;
  minimum_payment: number | null;
  status: string;
};

function calculatePayoff(debt: Debt) {
  const { balance, monthly_repayment, interest_rate } = debt;
  if (monthly_repayment <= 0 || balance <= 0)
    return { monthsRemaining: 0, estimatedPayoffDate: null, totalInterest: 0 };

  const monthlyRate = interest_rate / 12;
  let remaining = balance;
  let totalInterest = 0;
  let months = 0;

  while (remaining > 0.01 && months < 600) {
    const interest = remaining * monthlyRate;
    totalInterest += interest;
    remaining = remaining + interest - monthly_repayment;
    months++;
    if (remaining > balance * 2)
      return { monthsRemaining: Infinity, estimatedPayoffDate: null, totalInterest: Infinity };
  }

  const payoffDate = new Date();
  payoffDate.setMonth(payoffDate.getMonth() + months);
  return {
    monthsRemaining: months,
    estimatedPayoffDate: payoffDate.toISOString().slice(0, 10),
    totalInterest: Math.round(totalInterest * 100) / 100,
  };
}

function calculateLVR(debt: Debt) {
  if (!debt.property_value || debt.property_value <= 0) return null;
  const lvr = Math.round((debt.balance / debt.property_value) * 10000) / 100;
  const equity = debt.property_value - debt.balance;
  const availableEquity = Math.max(0, equity - debt.property_value * 0.2);
  return {
    lvr,
    equity: Math.round(equity * 100) / 100,
    availableEquity: Math.round(availableEquity * 100) / 100,
  };
}

export default function DebtsPage() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);

  const load = useCallback(() => {
    fetch("/api/budget/debts").then((r) => r.json()).then(setDebts);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addDebt(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await fetch("/api/budget/debts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name"),
        balance: Number(fd.get("balance")),
        monthly_repayment: Number(fd.get("monthly_repayment")),
        interest_rate: Number(fd.get("interest_rate")) / 100,
        is_mortgage: fd.get("is_mortgage") === "on",
        is_credit_card: fd.get("is_credit_card") === "on",
        credit_limit: fd.get("credit_limit") ? Number(fd.get("credit_limit")) : null,
        property_value: fd.get("property_value") ? Number(fd.get("property_value")) : null,
        start_date: fd.get("start_date") || null,
        end_date: fd.get("end_date") || null,
        minimum_payment: fd.get("minimum_payment") ? Number(fd.get("minimum_payment")) : null,
      }),
    });
    setShowAdd(false);
    load();
  }

  async function saveDebt(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingDebt) return;
    const fd = new FormData(e.currentTarget);
    await fetch(`/api/budget/debts/${editingDebt.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name"),
        balance: Number(fd.get("balance")),
        monthly_repayment: Number(fd.get("monthly_repayment")),
        interest_rate: Number(fd.get("interest_rate")) / 100,
        is_mortgage: fd.get("is_mortgage") === "on",
        is_credit_card: fd.get("is_credit_card") === "on",
        credit_limit: fd.get("credit_limit") ? Number(fd.get("credit_limit")) : null,
        property_value: fd.get("property_value") ? Number(fd.get("property_value")) : null,
        start_date: fd.get("start_date") || null,
        end_date: fd.get("end_date") || null,
        minimum_payment: fd.get("minimum_payment") ? Number(fd.get("minimum_payment")) : null,
      }),
    });
    setEditingDebt(null);
    load();
  }

  async function deleteDebt(id: string) {
    await fetch(`/api/budget/debts/${id}`, { method: "DELETE" });
    load();
  }

  const regularDebts = debts.filter((d) => !d.is_mortgage && !d.is_credit_card && d.status === "active");
  const creditCards = debts.filter((d) => d.is_credit_card && d.status === "active");
  const mortgages = debts.filter((d) => d.is_mortgage && d.status === "active");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Debts</h1>
          <p className="text-muted-foreground">
            Track debt balances, repayments, and payoff progress
          </p>
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger render={<Button />}>
            <Plus className="mr-2 h-4 w-4" />Add Debt
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Debt</DialogTitle></DialogHeader>
            <form onSubmit={addDebt} className="space-y-4">
              <div><Label>Name</Label><Input name="name" required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Balance</Label><Input name="balance" type="number" step="any" required /></div>
                <div><Label>Monthly Repayment</Label><Input name="monthly_repayment" type="number" step="any" required /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Interest Rate (%)</Label><Input name="interest_rate" type="number" step="any" required /></div>
                <div><Label>Minimum Payment</Label><Input name="minimum_payment" type="number" step="any" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Start Date</Label><Input name="start_date" type="date" /></div>
                <div><Label>End Date / Payoff Target</Label><Input name="end_date" type="date" /></div>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="is_mortgage" className="rounded border-input" />
                  <span className="text-sm">Mortgage</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="is_credit_card" className="rounded border-input" />
                  <span className="text-sm">Credit Card</span>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Property Value (mortgage)</Label><Input name="property_value" type="number" step="any" /></div>
                <div><Label>Credit Limit</Label><Input name="credit_limit" type="number" step="any" /></div>
              </div>
              <Button type="submit">Save</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {regularDebts.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Personal Debts</h2>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {regularDebts.map((d) => (
              <DebtPayoffCard
                key={d.id}
                name={d.name}
                balance={d.balance}
                monthlyRepayment={d.monthly_repayment}
                interestRate={d.interest_rate}
                payoff={calculatePayoff(d)}
                startDate={d.start_date}
                endDate={d.end_date}
                onEdit={() => setEditingDebt(d)}
                onDelete={() => deleteDebt(d.id)}
              />
            ))}
          </div>
        </div>
      )}

      {creditCards.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Credit Cards</h2>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {creditCards.map((d) => (
              <DebtPayoffCard
                key={d.id}
                name={d.name}
                balance={d.balance}
                monthlyRepayment={d.monthly_repayment}
                interestRate={d.interest_rate}
                payoff={calculatePayoff(d)}
                isCreditCard
                creditLimit={d.credit_limit}
                startDate={d.start_date}
                endDate={d.end_date}
                onEdit={() => setEditingDebt(d)}
                onDelete={() => deleteDebt(d.id)}
              />
            ))}
          </div>
        </div>
      )}

      {mortgages.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Mortgages</h2>
          <div className="grid gap-5 md:grid-cols-2">
            {mortgages.map((d) => (
              <DebtPayoffCard
                key={d.id}
                name={d.name}
                balance={d.balance}
                monthlyRepayment={d.monthly_repayment}
                interestRate={d.interest_rate}
                payoff={calculatePayoff(d)}
                isMortgage
                lvr={calculateLVR(d)}
                startDate={d.start_date}
                endDate={d.end_date}
                onEdit={() => setEditingDebt(d)}
                onDelete={() => deleteDebt(d.id)}
              />
            ))}
          </div>
        </div>
      )}

      {debts.filter((d) => d.status === "active").length === 0 && (
        <p className="text-center text-muted-foreground py-12">
          No debts tracked yet. Add your first debt to start tracking.
        </p>
      )}

      {/* Edit Debt Dialog */}
      <Dialog open={!!editingDebt} onOpenChange={(open) => { if (!open) setEditingDebt(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Debt</DialogTitle></DialogHeader>
          {editingDebt && (
            <form onSubmit={saveDebt} className="space-y-4">
              <div><Label>Name</Label><Input name="name" defaultValue={editingDebt.name} required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Balance</Label><Input name="balance" type="number" step="any" defaultValue={editingDebt.balance} required /></div>
                <div><Label>Monthly Repayment</Label><Input name="monthly_repayment" type="number" step="any" defaultValue={editingDebt.monthly_repayment} required /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Interest Rate (%)</Label><Input name="interest_rate" type="number" step="any" defaultValue={(editingDebt.interest_rate * 100).toFixed(2)} required /></div>
                <div><Label>Minimum Payment</Label><Input name="minimum_payment" type="number" step="any" defaultValue={editingDebt.minimum_payment ?? ""} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Start Date</Label><Input name="start_date" type="date" defaultValue={editingDebt.start_date ?? ""} /></div>
                <div><Label>End Date / Payoff Target</Label><Input name="end_date" type="date" defaultValue={editingDebt.end_date ?? ""} /></div>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="is_mortgage" defaultChecked={editingDebt.is_mortgage} className="rounded border-input" />
                  <span className="text-sm">Mortgage</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="is_credit_card" defaultChecked={editingDebt.is_credit_card} className="rounded border-input" />
                  <span className="text-sm">Credit Card</span>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Property Value (mortgage)</Label><Input name="property_value" type="number" step="any" defaultValue={editingDebt.property_value ?? ""} /></div>
                <div><Label>Credit Limit</Label><Input name="credit_limit" type="number" step="any" defaultValue={editingDebt.credit_limit ?? ""} /></div>
              </div>
              <Button type="submit">Save</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
