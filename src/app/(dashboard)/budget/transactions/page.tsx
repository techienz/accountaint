"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
  Check,
  X,
} from "lucide-react";

const fmt = (n: number) =>
  "$" +
  Math.abs(n).toLocaleString("en-NZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const BANK_LABELS: Record<string, string> = {
  asb: "ASB",
  anz: "ANZ",
  westpac: "Westpac",
  kiwibank: "Kiwibank",
  bnz: "BNZ",
  unknown: "Unknown",
};

type Transaction = {
  id: string;
  date: string;
  description: string;
  amount: number;
  balance: number | null;
  type: "debit" | "credit";
  category_id: string | null;
  bank_account_id: string | null;
  is_categorised: boolean;
};

type BankAccount = {
  id: string;
  name: string;
  institution: string | null;
};

type Category = {
  id: string;
  name: string;
  color: string | null;
};

type MonthlySummary = {
  month: string;
  totalSpending: number;
  totalIncome: number;
  byCategory: {
    categoryId: string | null;
    categoryName: string;
    categoryColor: string | null;
    total: number;
    count: number;
  }[];
};

type ImportResult = {
  bank: string;
  imported: number;
  duplicates: number;
  categorised: number;
  skipped: number;
};

type PreviewResult = {
  bank: string;
  total: number;
  transactions: {
    date: string;
    description: string;
    amount: number;
    type: "debit" | "credit";
  }[];
};

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [summaries, setSummaries] = useState<MonthlySummary[]>([]);

  // Filters
  const [filterAccount, setFilterAccount] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterStart, setFilterStart] = useState<string>("");
  const [filterEnd, setFilterEnd] = useState<string>("");
  const [showUncategorised, setShowUncategorised] = useState(false);
  const [search, setSearch] = useState("");

  // Import state
  const [showImport, setShowImport] = useState(false);
  const [importCsv, setImportCsv] = useState<string | null>(null);
  const [importAccountId, setImportAccountId] = useState<string>("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  // Inline editing
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingAcctId, setEditingAcctId] = useState<string | null>(null);

  // View mode
  const [view, setView] = useState<"transactions" | "spending">("transactions");

  const fileRef = useRef<HTMLInputElement>(null);

  const loadAccounts = useCallback(() => {
    fetch("/api/budget/bank-accounts")
      .then((r) => r.json())
      .then(setAccounts);
  }, []);

  const loadCategories = useCallback(() => {
    fetch("/api/budget/categories")
      .then((r) => r.json())
      .then(setCategories);
  }, []);

  const loadTransactions = useCallback(() => {
    const params = new URLSearchParams();
    if (filterAccount) params.set("account", filterAccount);
    if (filterCategory) params.set("category", filterCategory);
    if (filterStart) params.set("start", filterStart);
    if (filterEnd) params.set("end", filterEnd);
    if (showUncategorised) params.set("uncategorised", "true");
    fetch(`/api/budget/transactions?${params}`)
      .then((r) => r.json())
      .then(setTransactions);
  }, [filterAccount, filterCategory, filterStart, filterEnd, showUncategorised]);

  const loadSummary = useCallback(() => {
    const params = new URLSearchParams();
    if (filterStart) params.set("start", filterStart);
    if (filterEnd) params.set("end", filterEnd);
    fetch(`/api/budget/transactions/summary?${params}`)
      .then((r) => r.json())
      .then(setSummaries);
  }, [filterStart, filterEnd]);

  useEffect(() => {
    loadAccounts();
    loadCategories();
  }, [loadAccounts, loadCategories]);

  useEffect(() => {
    loadTransactions();
    loadSummary();
  }, [loadTransactions, loadSummary]);

  // ── Import handlers ─────────────────────────────────────────────

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    setPreview(null);
    setImportResult(null);

    const text = await file.text();
    setImportCsv(text);

    const res = await fetch("/api/budget/transactions/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv: text, preview: true }),
    });
    const data = await res.json();
    if (!res.ok) {
      setImportError(data.error);
      return;
    }
    if (data.total === 0) {
      setImportError("No transactions found in CSV");
      return;
    }
    setPreview(data);
  }

  async function confirmImport() {
    if (!importCsv) return;
    setImporting(true);
    const res = await fetch("/api/budget/transactions/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        csv: importCsv,
        bank_account_id: importAccountId || null,
      }),
    });
    const data = await res.json();
    setImporting(false);
    if (!res.ok) {
      setImportError(data.error);
      return;
    }
    setImportResult(data);
    setPreview(null);
    loadTransactions();
    loadSummary();
  }

  function closeImport() {
    setShowImport(false);
    setPreview(null);
    setImportResult(null);
    setImportError(null);
    setImportCsv(null);
    setImportAccountId("");
    if (fileRef.current) fileRef.current.value = "";
  }

  // ── Category update ─────────────────────────────────────────────

  async function setCategory(txId: string, categoryId: string | null) {
    await fetch(`/api/budget/transactions/${txId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category_id: categoryId }),
    });
    setEditingCatId(null);
    loadTransactions();
    loadSummary();
  }

  async function setAccount(txId: string, accountId: string | null) {
    await fetch(`/api/budget/transactions/${txId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bank_account_id: accountId }),
    });
    setEditingAcctId(null);
    loadTransactions();
  }

  // ── Filtered transactions ───────────────────────────────────────

  const filtered = search
    ? transactions.filter((t) =>
        t.description.toLowerCase().includes(search.toLowerCase())
      )
    : transactions;

  const totalDebits = filtered
    .filter((t) => t.type === "debit")
    .reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalCredits = filtered
    .filter((t) => t.type === "credit")
    .reduce((s, t) => s + t.amount, 0);

  const catLookup = new Map(categories.map((c) => [c.id, c]));
  const acctLookup = new Map(accounts.map((a) => [a.id, a]));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transactions</h1>
          <p className="text-muted-foreground">
            Import bank statements and track spending
          </p>
        </div>
        <Button onClick={() => setShowImport(true)}>
          <Upload className="mr-2 h-4 w-4" />
          Import CSV
        </Button>
      </div>

      {/* View toggle + filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border overflow-hidden">
          <button
            onClick={() => setView("transactions")}
            className={`px-4 py-1.5 text-sm transition-colors ${
              view === "transactions"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-accent"
            }`}
          >
            Transactions
          </button>
          <button
            onClick={() => setView("spending")}
            className={`px-4 py-1.5 text-sm transition-colors ${
              view === "spending"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-accent"
            }`}
          >
            Spending
          </button>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Input
            type="date"
            value={filterStart}
            onChange={(e) => setFilterStart(e.target.value)}
            className="w-36 h-8 text-xs"
            placeholder="From"
          />
          <Input
            type="date"
            value={filterEnd}
            onChange={(e) => setFilterEnd(e.target.value)}
            className="w-36 h-8 text-xs"
            placeholder="To"
          />
          {accounts.length > 0 && (
            <Select value={filterAccount} onValueChange={(v) => setFilterAccount(v ?? "")}>
              <SelectTrigger className="w-40 h-8 text-xs">
                <SelectValue placeholder="All accounts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All accounts</SelectItem>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {(filterStart || filterEnd || filterAccount) && (
            <button
              onClick={() => {
                setFilterStart("");
                setFilterEnd("");
                setFilterAccount("");
                setFilterCategory("");
                setShowUncategorised(false);
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Transactions View ──────────────────────────────────── */}
      {view === "transactions" && (
        <>
          {/* Summary strip */}
          {filtered.length > 0 && (
            <div className="grid gap-4 grid-cols-3">
              <Card>
                <CardContent className="pt-5 pb-4">
                  <p className="text-xs text-muted-foreground mb-1">
                    {filtered.length} transactions
                  </p>
                  <p className="text-lg font-bold">
                    {fmt(totalDebits + totalCredits)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5 pb-4">
                  <p className="text-xs text-muted-foreground mb-1">Spent</p>
                  <p className="text-lg font-bold text-red-600">
                    {fmt(totalDebits)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5 pb-4">
                  <p className="text-xs text-muted-foreground mb-1">Received</p>
                  <p className="text-lg font-bold text-green-600">
                    {fmt(totalCredits)}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Search + quick filters */}
          <div className="flex items-center gap-3">
            <Input
              placeholder="Search transactions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm h-8 text-sm"
            />
            <button
              onClick={() => setShowUncategorised(!showUncategorised)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                showUncategorised
                  ? "bg-amber-500/10 text-amber-600 border-amber-200"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              Uncategorised
            </button>
          </div>

          {/* Transaction list */}
          {filtered.length > 0 ? (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {filtered.map((tx) => {
                    const cat = tx.category_id
                      ? catLookup.get(tx.category_id)
                      : null;
                    const isEditingCat = editingCatId === tx.id;

                    return (
                      <div
                        key={tx.id}
                        className="flex items-center gap-4 px-4 py-3 hover:bg-accent/30 transition-colors"
                      >
                        {/* Icon */}
                        <div
                          className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${
                            tx.type === "debit"
                              ? "bg-red-500/10 text-red-500"
                              : "bg-green-500/10 text-green-500"
                          }`}
                        >
                          {tx.type === "debit" ? (
                            <ArrowUpRight className="h-4 w-4" />
                          ) : (
                            <ArrowDownLeft className="h-4 w-4" />
                          )}
                        </div>

                        {/* Description + date */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {tx.description}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(tx.date).toLocaleDateString("en-NZ", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </p>
                        </div>

                        {/* Account */}
                        <div className="shrink-0">
                          {editingAcctId === tx.id ? (
                            <div className="flex items-center gap-1">
                              <Select
                                defaultValue={tx.bank_account_id ?? "none"}
                                onValueChange={(v) =>
                                  setAccount(
                                    tx.id,
                                    v === "none" ? null : (v ?? null)
                                  )
                                }
                              >
                                <SelectTrigger className="h-7 text-xs w-32">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">
                                    No account
                                  </SelectItem>
                                  {accounts.map((a) => (
                                    <SelectItem key={a.id} value={a.id}>
                                      {a.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <button
                                onClick={() => setEditingAcctId(null)}
                                className="text-muted-foreground hover:text-foreground"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setEditingAcctId(tx.id)}
                              className="transition-colors"
                            >
                              {tx.bank_account_id ? (
                                <Badge
                                  variant="outline"
                                  className="text-xs cursor-pointer hover:bg-accent"
                                >
                                  {acctLookup.get(tx.bank_account_id)?.name ?? "Account"}
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="text-xs text-muted-foreground/40 border-dashed cursor-pointer hover:bg-accent"
                                >
                                  Account
                                </Badge>
                              )}
                            </button>
                          )}
                        </div>

                        {/* Category */}
                        <div className="shrink-0">
                          {isEditingCat ? (
                            <div className="flex items-center gap-1">
                              <Select
                                defaultValue={tx.category_id ?? "none"}
                                onValueChange={(v) =>
                                  setCategory(
                                    tx.id,
                                    v === "none" ? null : v
                                  )
                                }
                              >
                                <SelectTrigger className="h-7 text-xs w-36">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">
                                    Uncategorised
                                  </SelectItem>
                                  {categories.map((c) => (
                                    <SelectItem key={c.id} value={c.id}>
                                      {c.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <button
                                onClick={() => setEditingCatId(null)}
                                className="text-muted-foreground hover:text-foreground"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setEditingCatId(tx.id)}
                              className="transition-colors"
                            >
                              {cat ? (
                                <Badge
                                  variant="outline"
                                  className="text-xs cursor-pointer hover:bg-accent"
                                  style={{
                                    borderColor: cat.color ?? undefined,
                                    color: cat.color ?? undefined,
                                  }}
                                >
                                  {cat.name}
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="text-xs text-muted-foreground/50 border-dashed cursor-pointer hover:bg-accent"
                                >
                                  Categorise
                                </Badge>
                              )}
                            </button>
                          )}
                        </div>

                        {/* Amount */}
                        <p
                          className={`text-sm font-mono font-medium tabular-nums shrink-0 w-24 text-right ${
                            tx.type === "debit"
                              ? "text-red-600"
                              : "text-green-600"
                          }`}
                        >
                          {tx.type === "debit" ? "-" : "+"}
                          {fmt(tx.amount)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="text-center py-16">
              <p className="text-muted-foreground mb-4">
                No transactions yet. Import a bank CSV to get started.
              </p>
              <Button
                variant="outline"
                onClick={() => setShowImport(true)}
              >
                <Upload className="mr-2 h-4 w-4" />
                Import CSV
              </Button>
            </div>
          )}
        </>
      )}

      {/* ── Spending View ──────────────────────────────────────── */}
      {view === "spending" && (
        <>
          {summaries.length > 0 ? (
            <div className="space-y-6">
              {summaries.map((s) => {
                const maxCatTotal =
                  s.byCategory.length > 0
                    ? Math.max(...s.byCategory.map((c) => c.total))
                    : 1;

                return (
                  <Card key={s.month}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base font-semibold">
                          {new Date(s.month + "-01").toLocaleDateString(
                            "en-NZ",
                            { month: "long", year: "numeric" }
                          )}
                        </CardTitle>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-red-600 font-medium">
                            Spent: {fmt(s.totalSpending)}
                          </span>
                          <span className="text-green-600 font-medium">
                            Received: {fmt(s.totalIncome)}
                          </span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {s.byCategory.map((cat, i) => (
                          <div key={cat.categoryId ?? "uncat"}>
                            <div className="flex items-center justify-between text-sm mb-1">
                              <div className="flex items-center gap-2">
                                {cat.categoryColor && (
                                  <div
                                    className="w-2.5 h-2.5 rounded-full"
                                    style={{
                                      backgroundColor: cat.categoryColor,
                                    }}
                                  />
                                )}
                                <span className="font-medium">
                                  {cat.categoryName}
                                </span>
                                <span className="text-muted-foreground text-xs">
                                  ({cat.count})
                                </span>
                              </div>
                              <span className="font-mono tabular-nums font-medium">
                                {fmt(cat.total)}
                              </span>
                            </div>
                            <div className="h-2 bg-accent rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${(cat.total / maxCatTotal) * 100}%`,
                                  backgroundColor:
                                    cat.categoryColor ?? "#6b7280",
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-muted-foreground">
                No spending data yet. Import transactions to see your spending
                breakdown.
              </p>
            </div>
          )}
        </>
      )}

      {/* ── Import Dialog ──────────────────────────────────────── */}
      <Dialog open={showImport} onOpenChange={(open) => !open && closeImport()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Bank Statement</DialogTitle>
          </DialogHeader>

          {!importResult ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Upload a CSV export from your bank. Supported: ASB, ANZ,
                Westpac, Kiwibank, BNZ.
              </p>

              {accounts.length > 0 && (
                <div>
                  <Label>Link to account (optional)</Label>
                  <Select
                    value={importAccountId}
                    onValueChange={(v) => setImportAccountId(v ?? "")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No account</SelectItem>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                          {a.institution ? ` (${a.institution})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Input
                ref={fileRef}
                type="file"
                accept=".csv"
                onChange={handleFile}
              />

              {importError && (
                <p className="text-sm text-red-600">{importError}</p>
              )}

              {preview && (
                <>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {BANK_LABELS[preview.bank] || preview.bank}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {preview.total} transactions found
                    </span>
                  </div>

                  <div className="max-h-48 overflow-y-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50 text-left">
                          <th className="py-2 px-3 font-medium">Date</th>
                          <th className="py-2 px-3 font-medium">
                            Description
                          </th>
                          <th className="py-2 px-3 font-medium text-right">
                            Amount
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.transactions.slice(0, 20).map((tx, i) => (
                          <tr key={i} className="border-b last:border-0">
                            <td className="py-1.5 px-3 text-xs text-muted-foreground whitespace-nowrap">
                              {tx.date}
                            </td>
                            <td className="py-1.5 px-3 truncate max-w-[200px]">
                              {tx.description}
                            </td>
                            <td
                              className={`py-1.5 px-3 text-right font-mono text-xs ${
                                tx.type === "debit"
                                  ? "text-red-600"
                                  : "text-green-600"
                              }`}
                            >
                              {tx.type === "debit" ? "-" : "+"}
                              {fmt(tx.amount)}
                            </td>
                          </tr>
                        ))}
                        {preview.total > 20 && (
                          <tr>
                            <td
                              colSpan={3}
                              className="py-2 px-3 text-xs text-center text-muted-foreground"
                            >
                              ...and {preview.total - 20} more
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <Button onClick={confirmImport} disabled={importing}>
                    {importing
                      ? "Importing..."
                      : `Import ${preview.total} Transactions`}
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600">
                <Check className="h-5 w-5" />
                <span className="font-medium">Import complete</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-accent/50 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Imported</p>
                  <p className="text-lg font-bold">{importResult.imported}</p>
                </div>
                <div className="bg-accent/50 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">
                    Auto-categorised
                  </p>
                  <p className="text-lg font-bold">
                    {importResult.categorised}
                  </p>
                </div>
                <div className="bg-accent/50 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">
                    Duplicates skipped
                  </p>
                  <p className="text-lg font-bold">
                    {importResult.duplicates}
                  </p>
                </div>
                <div className="bg-accent/50 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Bank</p>
                  <p className="text-lg font-bold">
                    {BANK_LABELS[importResult.bank] || importResult.bank}
                  </p>
                </div>
              </div>
              <Button onClick={closeImport}>Done</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
