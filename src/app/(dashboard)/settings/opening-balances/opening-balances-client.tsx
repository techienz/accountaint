"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Props = {
  hasCoa: boolean;
  hasExisting: boolean;
  existingDate: string | null;
};

type LineItem = { name: string; amount: string };

export function OpeningBalancesClient({ hasCoa, hasExisting, existingDate }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentTaxYearStart = (() => {
    const now = new Date();
    const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    return `${year}-04-01`;
  })();
  const [effectiveDate, setEffectiveDate] = useState(existingDate || currentTaxYearStart);

  const [bankBalance, setBankBalance] = useState("");
  const [receivables, setReceivables] = useState<LineItem[]>([]);
  const [payables, setPayables] = useState<LineItem[]>([]);

  if (!hasCoa) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Opening Balances</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>
              You need to set up your Chart of Accounts first.{" "}
              <a href="/settings/chart-of-accounts" className="text-primary hover:underline">
                Go to Chart of Accounts
              </a>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  function addLine(setter: typeof setReceivables) {
    setter((prev) => [...prev, { name: "", amount: "" }]);
  }

  function updateLine(
    setter: typeof setReceivables,
    index: number,
    field: "name" | "amount",
    value: string
  ) {
    setter((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  }

  function removeLine(setter: typeof setReceivables, index: number) {
    setter((prev) => prev.filter((_, i) => i !== index));
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD" }).format(n);

  const totalReceivables = receivables.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const totalPayables = payables.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const bank = Number(bankBalance) || 0;
  const equity = bank + totalReceivables - totalPayables;

  async function handleSubmit() {
    setSaving(true);
    setError(null);

    const res = await fetch("/api/ledger/opening-balance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        effectiveDate,
        bankBalance: bank,
        receivables: receivables
          .filter((r) => r.name && Number(r.amount) > 0)
          .map((r) => ({ name: r.name, amount: Number(r.amount) })),
        payables: payables
          .filter((p) => p.name && Number(p.amount) > 0)
          .map((p) => ({ name: p.name, amount: Number(p.amount) })),
      }),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok || data.error) {
      setError(data.error || "Failed to save opening balances");
      return;
    }

    router.push("/reports/trial-balance");
  }

  const steps = [
    // Step 0: Effective date
    <Card key="date">
      <CardHeader>
        <CardTitle>Opening Balances</CardTitle>
        <CardDescription>
          {hasExisting
            ? "You already have opening balances recorded. This will replace them."
            : "Set your starting position so reports are accurate from day one."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="date">What date are you starting from?</Label>
          <Input
            id="date"
            type="date"
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            Usually the start of your tax year (1 April) or the date you began trading.
          </p>
        </div>
        <Button onClick={() => setStep(1)}>Next</Button>
      </CardContent>
    </Card>,

    // Step 1: Bank balance
    <Card key="bank">
      <CardHeader>
        <CardTitle>Bank Balance</CardTitle>
        <CardDescription>
          What was your business bank account balance on {effectiveDate}?
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="bank">Bank balance ($)</Label>
          <Input
            id="bank"
            type="number"
            step="0.01"
            placeholder="0.00"
            value={bankBalance}
            onChange={(e) => setBankBalance(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            Enter a negative number if the account was overdrawn.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setStep(0)}>Back</Button>
          <Button onClick={() => setStep(2)}>Next</Button>
        </div>
      </CardContent>
    </Card>,

    // Step 2: Receivables
    <Card key="receivables">
      <CardHeader>
        <CardTitle>Outstanding Receivables</CardTitle>
        <CardDescription>
          Did anyone owe you money on {effectiveDate}? (e.g. unpaid invoices)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {receivables.map((r, i) => (
          <div key={i} className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <Label>Who owes you?</Label>
              <Input
                placeholder="Contact or company name"
                value={r.name}
                onChange={(e) => updateLine(setReceivables, i, "name", e.target.value)}
              />
            </div>
            <div className="w-32 space-y-1">
              <Label>Amount ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={r.amount}
                onChange={(e) => updateLine(setReceivables, i, "amount", e.target.value)}
              />
            </div>
            <Button variant="ghost" size="sm" onClick={() => removeLine(setReceivables, i)}>
              Remove
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => addLine(setReceivables)}>
          + Add receivable
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
          <Button onClick={() => setStep(3)}>Next</Button>
        </div>
      </CardContent>
    </Card>,

    // Step 3: Payables
    <Card key="payables">
      <CardHeader>
        <CardTitle>Outstanding Payables</CardTitle>
        <CardDescription>
          Did you owe anyone money on {effectiveDate}? (e.g. unpaid bills)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {payables.map((p, i) => (
          <div key={i} className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <Label>Who do you owe?</Label>
              <Input
                placeholder="Contact or company name"
                value={p.name}
                onChange={(e) => updateLine(setPayables, i, "name", e.target.value)}
              />
            </div>
            <div className="w-32 space-y-1">
              <Label>Amount ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={p.amount}
                onChange={(e) => updateLine(setPayables, i, "amount", e.target.value)}
              />
            </div>
            <Button variant="ghost" size="sm" onClick={() => removeLine(setPayables, i)}>
              Remove
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => addLine(setPayables)}>
          + Add payable
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
          <Button onClick={() => setStep(4)}>Next</Button>
        </div>
      </CardContent>
    </Card>,

    // Step 4: Review
    <Card key="review">
      <CardHeader>
        <CardTitle>Review Opening Balances</CardTitle>
        <CardDescription>As at {effectiveDate}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border p-4 space-y-2">
          <div className="flex justify-between">
            <span>Bank balance</span>
            <span className="font-medium">{fmt(bank)}</span>
          </div>
          {totalReceivables > 0 && (
            <div className="flex justify-between">
              <span>Money owed to you ({receivables.filter((r) => Number(r.amount) > 0).length} contacts)</span>
              <span className="font-medium">{fmt(totalReceivables)}</span>
            </div>
          )}
          {totalPayables > 0 && (
            <div className="flex justify-between">
              <span>Money you owe ({payables.filter((p) => Number(p.amount) > 0).length} contacts)</span>
              <span className="font-medium text-red-600">-{fmt(totalPayables)}</span>
            </div>
          )}
          <hr />
          <div className="flex justify-between font-medium">
            <span>Starting equity</span>
            <span>{fmt(equity)}</span>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <p className="text-sm text-muted-foreground">
          This creates an opening balance journal entry. You can add assets separately via the Asset Register.
        </p>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setStep(3)}>Back</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving..." : hasExisting ? "Replace Opening Balances" : "Create Opening Balances"}
          </Button>
        </div>
      </CardContent>
    </Card>,
  ];

  return steps[step];
}
