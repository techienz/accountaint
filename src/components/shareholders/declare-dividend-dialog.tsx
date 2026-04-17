"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Props = {
  onSuccess: () => void;
};

export function DeclareDividendDialog({ onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    resolutionNumber: string;
    documentId: string;
    totalAmount: number;
  } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/dividends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        total_amount: Number(amount),
        notes: notes || undefined,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      setResult({
        resolutionNumber: data.resolutionNumber,
        documentId: data.documentId,
        totalAmount: data.totalAmount,
      });
      onSuccess();
    } else {
      const data = await res.json();
      setError(data.error || "Failed to declare dividend");
    }
    setSubmitting(false);
  }

  function handleClose() {
    setOpen(false);
    setResult(null);
    setError(null);
    setAmount("");
    setNotes("");
  }

  const fmt = (n: number) =>
    "$" + n.toLocaleString("en-NZ", { minimumFractionDigits: 2 });

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : handleClose())}>
      <DialogTrigger render={<Button variant="outline" />}>
        Declare Dividend
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Declare Dividend</DialogTitle>
          <DialogDescription>
            This will generate a board resolution (Companies Act 1993 s107),
            record the shareholder transaction, and post the journal entry.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950">
              <p className="font-medium text-green-800 dark:text-green-200">
                Dividend declared successfully
              </p>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                Resolution {result.resolutionNumber} &mdash; {fmt(result.totalAmount)}
              </p>
              <p className="text-sm text-green-700 dark:text-green-300">
                Board resolution PDF saved to Document Vault.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  window.open(`/documents?highlight=${result.documentId}`, "_blank")
                }
              >
                View in Document Vault
              </Button>
              <Button onClick={handleClose}>Done</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="div-date">Date</Label>
              <Input
                id="div-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="div-amount">Total Dividend Amount ($)</Label>
              <Input
                id="div-amount"
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
            <div>
              <Label htmlFor="div-notes">Notes (optional)</Label>
              <Input
                id="div-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Monthly dividend for April 2026"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting
                ? "Declaring dividend..."
                : "Declare Dividend & Generate Resolution"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
