"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Transaction = {
  id: string;
  date: string;
  description: string;
  amount: number;
  merchant_name: string | null;
  reconciliation_status: string;
  matched_journal_entry_id: string | null;
  akahu_account_id: string;
  receipt_path: string | null;
};

type BankAccount = {
  id: string;
  name: string;
  institution: string;
};

type Account = {
  id: string;
  code: string;
  name: string;
  type: string;
};

type MatchSuggestion = {
  journal_entry_id: string;
  entry_number: number;
  date: string;
  description: string;
  amount: number;
  confidence: "high" | "medium" | "low";
};

export function ReconcileClient({
  transactions,
  accounts,
  bankAccounts = [],
}: {
  transactions: Transaction[];
  accounts: Account[];
  bankAccounts?: BankAccount[];
}) {
  const [filter, setFilter] = useState<string>("unmatched");
  const [selectedBankAccount, setSelectedBankAccount] = useState<string>("all");
  const [working, setWorking] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Record<string, MatchSuggestion[]>>({});
  const [invoiceToast, setInvoiceToast] = useState<{
    invoiceId: string;
    invoiceNumber: string;
    contactName: string | null;
    amount: number;
  } | null>(null);

  const filtered = transactions.filter((t) => {
    if (filter !== "all" && t.reconciliation_status !== filter) return false;
    if (selectedBankAccount !== "all" && t.akahu_account_id !== selectedBankAccount) return false;
    return true;
  });

  async function handleAction(txnId: string, action: string, extra?: Record<string, unknown>) {
    setWorking(txnId);
    try {
      const res = await fetch("/api/ledger/reconciliation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, bankTransactionId: txnId, ...extra }),
      });
      const data = await res.json();

      if (data.linkedInvoice?.markedPaid) {
        setInvoiceToast(data.linkedInvoice);
        setTimeout(() => window.location.reload(), 2000);
        return;
      }

      window.location.reload();
    } finally {
      setWorking(null);
    }
  }

  async function fetchSuggestions(txnId: string) {
    const res = await fetch(`/api/ledger/reconciliation?action=suggest&txnId=${txnId}`);
    const data = await res.json();
    setSuggestions((prev) => ({ ...prev, [txnId]: data }));
  }

  async function applyRules() {
    setWorking("rules");
    await fetch("/api/ledger/reconciliation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "apply_rules" }),
    });
    window.location.reload();
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case "unmatched": return <Badge variant="outline" className="text-yellow-500 border-yellow-500">Unmatched</Badge>;
      case "matched": return <Badge variant="outline" className="text-blue-500 border-blue-500">Matched</Badge>;
      case "reconciled": return <Badge variant="outline" className="text-green-500 border-green-500">Reconciled</Badge>;
      case "excluded": return <Badge variant="outline" className="text-muted-foreground">Excluded</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const expenseAccounts = accounts.filter((a) => a.type === "expense" || a.type === "revenue");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        {bankAccounts.length > 1 && (
          <Select value={selectedBankAccount} onValueChange={(v) => v && setSelectedBankAccount(v)}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="All accounts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All accounts</SelectItem>
              {bankAccounts.map((ba) => (
                <SelectItem key={ba.id} value={ba.id}>
                  {ba.name} ({ba.institution})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={filter} onValueChange={(v) => v && setFilter(v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All transactions</SelectItem>
            <SelectItem value="unmatched">Unmatched</SelectItem>
            <SelectItem value="matched">Matched</SelectItem>
            <SelectItem value="reconciled">Reconciled</SelectItem>
            <SelectItem value="excluded">Excluded</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={applyRules}
          disabled={working === "rules"}
        >
          {working === "rules" ? "Applying..." : "Apply Rules"}
        </Button>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No transactions matching this filter.
          </p>
        )}
        {filtered.map((txn) => (
          <div key={txn.id} className="rounded-lg border p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">{txn.date}</span>
                <span className="font-medium">
                  {txn.merchant_name || txn.description}
                </span>
                {statusBadge(txn.reconciliation_status)}
              </div>
              <span className={`font-mono font-bold ${txn.amount < 0 ? "text-red-500" : "text-green-500"}`}>
                {txn.amount < 0 ? "-" : "+"}${Math.abs(txn.amount).toFixed(2)}
              </span>
            </div>

            {txn.merchant_name && (
              <p className="text-xs text-muted-foreground">{txn.description}</p>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
              {txn.reconciliation_status === "unmatched" && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fetchSuggestions(txn.id)}
                    disabled={working === txn.id}
                  >
                    Find matches
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAction(txn.id, "exclude")}
                    disabled={working === txn.id}
                  >
                    Exclude
                  </Button>
                </>
              )}
              {txn.reconciliation_status === "matched" && (
                <>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handleAction(txn.id, "reconcile")}
                    disabled={working === txn.id}
                  >
                    Confirm
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAction(txn.id, "unmatch")}
                    disabled={working === txn.id}
                  >
                    Unmatch
                  </Button>
                </>
              )}
              {txn.reconciliation_status === "excluded" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAction(txn.id, "unmatch")}
                  disabled={working === txn.id}
                >
                  Un-exclude
                </Button>
              )}

              {/* Receipt upload */}
              <div className="ml-auto flex items-center gap-2">
                {txn.receipt_path ? (
                  <a
                    href={`/api/banking/transactions/${txn.id}/receipt`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-green-600 dark:text-green-400 hover:underline flex items-center gap-1"
                  >
                    <span>&#128206;</span> Receipt
                  </a>
                ) : null}
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const formData = new FormData();
                      formData.append("receipt", file);
                      const res = await fetch(`/api/banking/transactions/${txn.id}/receipt`, { method: "POST", body: formData });
                      if (res.ok) window.location.reload();
                    }}
                  />
                  <span className="text-xs text-muted-foreground hover:text-foreground cursor-pointer">
                    {txn.receipt_path ? "Replace" : "Upload receipt"}
                  </span>
                </label>
              </div>
            </div>

            {/* Match suggestions */}
            {suggestions[txn.id] && suggestions[txn.id].length > 0 && (
              <div className="ml-4 mt-2 space-y-1 border-l-2 pl-3">
                <p className="text-xs font-medium text-muted-foreground">Suggested matches:</p>
                {suggestions[txn.id].map((s) => (
                  <div key={s.journal_entry_id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={
                        s.confidence === "high" ? "text-green-500" :
                        s.confidence === "medium" ? "text-yellow-500" : "text-muted-foreground"
                      }>
                        {s.confidence}
                      </Badge>
                      <span>JE#{s.entry_number}: {s.description}</span>
                      <span className="text-muted-foreground">{s.date}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAction(txn.id, "match", { journalEntryId: s.journal_entry_id })}
                    >
                      Match
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {suggestions[txn.id] && suggestions[txn.id].length === 0 && txn.reconciliation_status === "unmatched" && (
              <div className="ml-4 mt-2 border-l-2 pl-3 space-y-2">
                <p className="text-xs text-muted-foreground">No matches found. Create a journal entry:</p>
                <CreateJournalForm
                  txnId={txn.id}
                  accounts={expenseAccounts}
                  defaultDescription={txn.merchant_name || txn.description}
                  onSubmit={(accountCode, description, gstInclusive) =>
                    handleAction(txn.id, "create_and_match", { accountCode, description, gstInclusive })
                  }
                  disabled={working === txn.id}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {invoiceToast && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-lg border bg-background p-4 shadow-lg">
          <div className="flex-1">
            <p className="font-medium">Invoice #{invoiceToast.invoiceNumber} marked as paid</p>
            <p className="text-sm text-muted-foreground">
              {invoiceToast.contactName ? `${invoiceToast.contactName} — ` : ""}
              {new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD" }).format(invoiceToast.amount)}
            </p>
          </div>
          <a
            href={`/invoices/${invoiceToast.invoiceId}`}
            className="text-sm font-medium text-primary hover:underline"
          >
            View Invoice
          </a>
          <button
            onClick={() => setInvoiceToast(null)}
            className="text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

function CreateJournalForm({
  txnId,
  accounts,
  defaultDescription,
  onSubmit,
  disabled,
}: {
  txnId: string;
  accounts: Account[];
  defaultDescription: string;
  onSubmit: (accountCode: string, description: string, gstInclusive: boolean) => void;
  disabled: boolean;
}) {
  const [accountCode, setAccountCode] = useState<string>("");
  const [description, setDescription] = useState(defaultDescription);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Select value={accountCode} onValueChange={(v) => v && setAccountCode(v)}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Select account" />
        </SelectTrigger>
        <SelectContent>
          {accounts.map((a) => (
            <SelectItem key={a.id} value={a.code}>
              {a.code} — {a.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <input
        className="flex h-9 w-[200px] rounded-md border border-input bg-transparent px-3 py-1 text-sm"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description"
      />
      <Button
        size="sm"
        disabled={!accountCode || disabled}
        onClick={() => onSubmit(accountCode, description, true)}
      >
        Create & Match
      </Button>
    </div>
  );
}
