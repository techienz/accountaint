"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Landmark } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const fmt = (n: number) =>
  "$" + n.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const typeLabels: Record<string, string> = {
  everyday: "Everyday",
  savings: "Savings",
  term_deposit: "Term Deposit",
  investment: "Investment",
  other: "Other",
};

type BankAccount = {
  id: string;
  name: string;
  institution: string | null;
  account_type: string;
  balance: number;
  is_active: boolean;
  last_updated: string;
};

export default function BankAccountsPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<BankAccount | null>(null);

  const load = useCallback(() => {
    fetch("/api/budget/bank-accounts").then((r) => r.json()).then(setAccounts);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addAccount(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await fetch("/api/budget/bank-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name"),
        institution: fd.get("institution") || null,
        account_type: fd.get("account_type") || "everyday",
        balance: Number(fd.get("balance") || 0),
      }),
    });
    setShowAdd(false);
    load();
  }

  async function saveAccount(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    const fd = new FormData(e.currentTarget);
    await fetch(`/api/budget/bank-accounts/${editing.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name"),
        institution: fd.get("institution") || null,
        account_type: fd.get("account_type") || "everyday",
        balance: Number(fd.get("balance") || 0),
      }),
    });
    setEditing(null);
    load();
  }

  async function deleteAccount(id: string) {
    await fetch(`/api/budget/bank-accounts/${id}`, { method: "DELETE" });
    load();
  }

  const active = accounts.filter((a) => a.is_active);
  const totalBalance = active.reduce((s, a) => s + a.balance, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bank Accounts</h1>
          <p className="text-muted-foreground">
            Track balances across your personal accounts
          </p>
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger render={<Button />}>
            <Plus className="mr-2 h-4 w-4" />Add Account
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Bank Account</DialogTitle></DialogHeader>
            <form onSubmit={addAccount} className="space-y-4">
              <div><Label>Account Name</Label><Input name="name" required placeholder="e.g. ASB Everyday" /></div>
              <div><Label>Institution</Label><Input name="institution" placeholder="e.g. ASB" /></div>
              <div>
                <Label>Type</Label>
                <Select name="account_type" defaultValue="everyday">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="everyday">Everyday</SelectItem>
                    <SelectItem value="savings">Savings</SelectItem>
                    <SelectItem value="term_deposit">Term Deposit</SelectItem>
                    <SelectItem value="investment">Investment</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Current Balance</Label><Input name="balance" type="number" step="any" defaultValue={0} /></div>
              <Button type="submit">Save</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Total */}
      {active.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total across all accounts</span>
              <span className={`text-2xl font-bold ${totalBalance >= 0 ? "text-green-600" : "text-red-600"}`}>
                {fmt(totalBalance)}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Account cards */}
      {active.length > 0 ? (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {active.map((a) => (
            <Card key={a.id}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium">{a.name}</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{typeLabels[a.account_type] || a.account_type}</Badge>
                  <button onClick={() => setEditing(a)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-accent">
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                  <button onClick={() => deleteAccount(a.id)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded-md hover:bg-destructive/10">
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${a.balance >= 0 ? "" : "text-red-600"}`}>
                  {fmt(a.balance)}
                </p>
                {a.institution && (
                  <p className="text-xs text-muted-foreground mt-1">{a.institution}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-center text-muted-foreground py-12">
          No bank accounts yet. Add your first account to start tracking.
        </p>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Bank Account</DialogTitle></DialogHeader>
          {editing && (
            <form onSubmit={saveAccount} className="space-y-4">
              <div><Label>Account Name</Label><Input name="name" defaultValue={editing.name} required /></div>
              <div><Label>Institution</Label><Input name="institution" defaultValue={editing.institution ?? ""} /></div>
              <div>
                <Label>Type</Label>
                <Select name="account_type" defaultValue={editing.account_type}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="everyday">Everyday</SelectItem>
                    <SelectItem value="savings">Savings</SelectItem>
                    <SelectItem value="term_deposit">Term Deposit</SelectItem>
                    <SelectItem value="investment">Investment</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Current Balance</Label><Input name="balance" type="number" step="any" defaultValue={editing.balance} /></div>
              <Button type="submit">Save</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
