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
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, TrendingUp, History, Upload } from "lucide-react";

const fmt = (n: number) =>
  "$" +
  Math.abs(n).toLocaleString("en-NZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtPct = (n: number) =>
  (n >= 0 ? "+" : "") + n.toFixed(1) + "%";

const typeLabels: Record<string, string> = {
  shares: "Shares",
  kiwisaver: "KiwiSaver",
  term_deposit: "Term Deposit",
  managed_fund: "Managed Fund",
  crypto: "Crypto",
  property: "Property",
  other: "Other",
};

const typeColors: Record<string, string> = {
  shares: "bg-blue-500/10 text-blue-600 border-blue-200",
  kiwisaver: "bg-green-500/10 text-green-600 border-green-200",
  term_deposit: "bg-amber-500/10 text-amber-600 border-amber-200",
  managed_fund: "bg-purple-500/10 text-purple-600 border-purple-200",
  crypto: "bg-orange-500/10 text-orange-600 border-orange-200",
  property: "bg-teal-500/10 text-teal-600 border-teal-200",
  other: "bg-gray-500/10 text-gray-600 border-gray-200",
};

type Investment = {
  id: string;
  name: string;
  type: string;
  platform: string | null;
  units: number | null;
  cost_basis: number;
  current_value: number;
  currency: string;
  nzd_rate: number;
  purchase_date: string | null;
  notes: string | null;
  status: string;
};

type ValueHistoryEntry = {
  id: string;
  value: number;
  nzd_rate: number;
  recorded_at: string;
};

function calcReturn(inv: Investment) {
  const currentNzd = inv.current_value * inv.nzd_rate;
  const costNzd = inv.cost_basis * inv.nzd_rate;
  const totalReturn = currentNzd - costNzd;
  const returnPct = costNzd > 0 ? (totalReturn / costNzd) * 100 : 0;

  let annualisedReturn: number | null = null;
  if (inv.purchase_date && costNzd > 0 && currentNzd > 0) {
    const years =
      (Date.now() - new Date(inv.purchase_date).getTime()) /
      (1000 * 60 * 60 * 24 * 365.25);
    if (years >= 0.01) {
      annualisedReturn = (Math.pow(currentNzd / costNzd, 1 / years) - 1) * 100;
    }
  }

  return { totalReturn, returnPct, annualisedReturn };
}

export default function InvestmentsPage() {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Investment | null>(null);
  const [historyFor, setHistoryFor] = useState<Investment | null>(null);
  const [history, setHistory] = useState<ValueHistoryEntry[]>([]);
  const [showCurrency, setShowCurrency] = useState(false);
  const [editShowCurrency, setEditShowCurrency] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importPreview, setImportPreview] = useState<
    { name: string; ticker: string; currency: string; units: number; cost_basis: number; current_value: number }[] | null
  >(null);
  const [importCsv, setImportCsv] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const load = useCallback(() => {
    fetch("/api/budget/investments")
      .then((r) => r.json())
      .then(setInvestments);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (historyFor) {
      fetch(`/api/budget/investments/${historyFor.id}/history`)
        .then((r) => r.json())
        .then(setHistory);
    }
  }, [historyFor]);

  async function addInvestment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const currency = fd.get("currency") as string || "NZD";
    await fetch("/api/budget/investments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name"),
        type: fd.get("type"),
        platform: fd.get("platform") || null,
        units: fd.get("units") ? Number(fd.get("units")) : null,
        cost_basis: Number(fd.get("cost_basis")),
        current_value: Number(fd.get("current_value")),
        currency,
        nzd_rate: currency !== "NZD" ? Number(fd.get("nzd_rate") || 1) : 1,
        purchase_date: fd.get("purchase_date") || null,
        notes: fd.get("notes") || null,
      }),
    });
    setShowAdd(false);
    setShowCurrency(false);
    load();
  }

  async function saveInvestment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    const fd = new FormData(e.currentTarget);
    const currency = fd.get("currency") as string || "NZD";
    await fetch(`/api/budget/investments/${editing.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name"),
        type: fd.get("type"),
        platform: fd.get("platform") || null,
        units: fd.get("units") ? Number(fd.get("units")) : null,
        cost_basis: Number(fd.get("cost_basis")),
        current_value: Number(fd.get("current_value")),
        currency,
        nzd_rate: currency !== "NZD" ? Number(fd.get("nzd_rate") || 1) : 1,
        purchase_date: fd.get("purchase_date") || null,
        notes: fd.get("notes") || null,
        status: fd.get("status") || "active",
      }),
    });
    setEditing(null);
    setEditShowCurrency(false);
    load();
  }

  async function deleteInvestment(id: string) {
    await fetch(`/api/budget/investments/${id}`, { method: "DELETE" });
    load();
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    setImportPreview(null);

    const text = await file.text();
    setImportCsv(text);

    const res = await fetch("/api/budget/investments/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv: text, preview: true }),
    });
    const data = await res.json();
    if (!res.ok) {
      setImportError(data.error || "Failed to parse CSV");
      return;
    }
    if (data.holdings.length === 0) {
      setImportError("No holdings found in CSV (all rows may have zero ending value)");
      return;
    }
    setImportPreview(data.holdings);
  }

  async function confirmImport() {
    if (!importCsv) return;
    setImporting(true);
    await fetch("/api/budget/investments/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv: importCsv }),
    });
    setImporting(false);
    setShowImport(false);
    setImportPreview(null);
    setImportCsv(null);
    load();
  }

  const active = investments.filter((i) => i.status === "active");
  const sold = investments.filter((i) => i.status === "sold");

  const totalValue = active.reduce(
    (s, i) => s + i.current_value * i.nzd_rate,
    0
  );
  const totalCost = active.reduce(
    (s, i) => s + i.cost_basis * i.nzd_rate,
    0
  );
  const totalReturn = totalValue - totalCost;
  const totalReturnPct = totalCost > 0 ? (totalReturn / totalCost) * 100 : 0;

  // Allocation by type
  const allocationByType: Record<string, { value: number; pct: number }> = {};
  for (const inv of active) {
    const nzdValue = inv.current_value * inv.nzd_rate;
    if (!allocationByType[inv.type])
      allocationByType[inv.type] = { value: 0, pct: 0 };
    allocationByType[inv.type].value += nzdValue;
  }
  for (const type of Object.keys(allocationByType)) {
    allocationByType[type].pct =
      totalValue > 0 ? (allocationByType[type].value / totalValue) * 100 : 0;
  }

  function InvestmentForm({
    onSubmit,
    defaults,
    isEdit,
  }: {
    onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
    defaults?: Investment;
    isEdit?: boolean;
  }) {
    const currencyShown = isEdit ? editShowCurrency : showCurrency;
    const defaultCurrency = defaults?.currency || "NZD";
    const showFx = currencyShown || (defaultCurrency !== "NZD");

    return (
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label>Name</Label>
          <Input name="name" required defaultValue={defaults?.name} placeholder="e.g. Sharesies NZX50" />
        </div>
        <div>
          <Label>Type</Label>
          <Select name="type" defaultValue={defaults?.type || "shares"}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(typeLabels).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Platform</Label>
          <Input name="platform" defaultValue={defaults?.platform ?? ""} placeholder="e.g. Sharesies, InvestNow" />
        </div>
        <div>
          <Label>Units (optional)</Label>
          <Input name="units" type="number" step="any" defaultValue={defaults?.units ?? ""} placeholder="Leave blank for KiwiSaver/managed funds" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Total Invested</Label>
            <Input name="cost_basis" type="number" step="any" required defaultValue={defaults?.cost_basis} />
          </div>
          <div>
            <Label>Current Value</Label>
            <Input name="current_value" type="number" step="any" required defaultValue={defaults?.current_value} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Currency</Label>
            <Select
              name="currency"
              defaultValue={defaultCurrency}
              onValueChange={(v) => {
                if (isEdit) setEditShowCurrency(v !== "NZD");
                else setShowCurrency(v !== "NZD");
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NZD">NZD</SelectItem>
                <SelectItem value="AUD">AUD</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {showFx && (
            <div>
              <Label>NZD Exchange Rate</Label>
              <Input name="nzd_rate" type="number" step="any" defaultValue={defaults?.nzd_rate ?? 1} />
            </div>
          )}
        </div>
        <div>
          <Label>Purchase Date</Label>
          <Input name="purchase_date" type="date" defaultValue={defaults?.purchase_date ?? ""} />
        </div>
        <div>
          <Label>Notes</Label>
          <Input name="notes" defaultValue={defaults?.notes ?? ""} />
        </div>
        {isEdit && (
          <div>
            <Label>Status</Label>
            <Select name="status" defaultValue={defaults?.status || "active"}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="sold">Sold</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <Button type="submit">Save</Button>
      </form>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Investments</h1>
          <p className="text-muted-foreground">
            Track your investment portfolio and returns
          </p>
        </div>
        <div className="flex items-center gap-2">
        <Button variant="outline" onClick={() => setShowImport(true)}>
          <Upload className="mr-2 h-4 w-4" />
          Import Sharesies
        </Button>
        <Dialog open={showAdd} onOpenChange={(open) => { setShowAdd(open); if (!open) setShowCurrency(false); }}>
          <DialogTrigger render={<Button />}>
            <Plus className="mr-2 h-4 w-4" />
            Add Investment
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Investment</DialogTitle>
            </DialogHeader>
            <InvestmentForm onSubmit={addInvestment} />
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Summary cards */}
      {active.length > 0 && (
        <div className="grid gap-5 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Total Portfolio Value
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{fmt(totalValue)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Total Cost Basis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-muted-foreground">
                {fmt(totalCost)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Total Return
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p
                className={`text-2xl font-bold ${totalReturn >= 0 ? "text-green-600" : "text-red-600"}`}
              >
                {totalReturn >= 0 ? "+" : "-"}
                {fmt(totalReturn)} ({fmtPct(totalReturnPct)})
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Allocation breakdown */}
      {active.length > 0 && Object.keys(allocationByType).length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Allocation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(allocationByType)
                .sort(([, a], [, b]) => b.value - a.value)
                .map(([type, data]) => (
                  <Badge
                    key={type}
                    variant="outline"
                    className={typeColors[type] || typeColors.other}
                  >
                    {typeLabels[type] || type} — {fmt(data.value)} (
                    {data.pct.toFixed(1)}%)
                  </Badge>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Holdings grid */}
      {active.length > 0 ? (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {active.map((inv) => {
            const ret = calcReturn(inv);
            return (
              <Card key={inv.id}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <TrendingUp className="h-4 w-4 text-muted-foreground shrink-0" />
                    <CardTitle className="text-sm font-medium truncate">
                      {inv.name}
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge
                      variant="outline"
                      className={typeColors[inv.type] || typeColors.other}
                    >
                      {typeLabels[inv.type] || inv.type}
                    </Badge>
                    {inv.currency !== "NZD" && (
                      <Badge variant="outline">{inv.currency}</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {fmt(inv.current_value * inv.nzd_rate)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Cost basis: {fmt(inv.cost_basis * inv.nzd_rate)}
                  </p>
                  <p
                    className={`text-sm font-medium mt-1 ${ret.totalReturn >= 0 ? "text-green-600" : "text-red-600"}`}
                  >
                    {ret.totalReturn >= 0 ? "+" : "-"}
                    {fmt(ret.totalReturn)} ({fmtPct(ret.returnPct)})
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    {ret.annualisedReturn != null && (
                      <span>
                        Annualised: {fmtPct(ret.annualisedReturn)}
                      </span>
                    )}
                    {inv.platform && <span>{inv.platform}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                    <button
                      onClick={() => setHistoryFor(inv)}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-accent"
                    >
                      <History className="h-3 w-3" /> History
                    </button>
                    <button
                      onClick={() => { setEditing(inv); setEditShowCurrency(inv.currency !== "NZD"); }}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-accent"
                    >
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                    <button
                      onClick={() => deleteInvestment(inv.id)}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded-md hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <p className="text-center text-muted-foreground py-12">
          No investments yet. Add your first holding to start tracking your
          portfolio.
        </p>
      )}

      {/* Sold holdings */}
      {sold.length > 0 && (
        <>
          <h2 className="text-lg font-semibold text-muted-foreground mt-8">
            Sold
          </h2>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {sold.map((inv) => {
              const ret = calcReturn(inv);
              return (
                <Card key={inv.id} className="opacity-60">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <CardTitle className="text-sm font-medium truncate">
                        {inv.name}
                      </CardTitle>
                    </div>
                    <Badge variant="outline">Sold</Badge>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg font-bold">
                      {fmt(inv.current_value * inv.nzd_rate)}
                    </p>
                    <p
                      className={`text-sm ${ret.totalReturn >= 0 ? "text-green-600" : "text-red-600"}`}
                    >
                      {ret.totalReturn >= 0 ? "+" : "-"}
                      {fmt(ret.totalReturn)} ({fmtPct(ret.returnPct)})
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => { setEditing(inv); setEditShowCurrency(inv.currency !== "NZD"); }}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-accent"
                      >
                        <Pencil className="h-3 w-3" /> Edit
                      </button>
                      <button
                        onClick={() => deleteInvestment(inv.id)}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded-md hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3 w-3" /> Delete
                      </button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Edit dialog */}
      <Dialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) { setEditing(null); setEditShowCurrency(false); }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Investment</DialogTitle>
          </DialogHeader>
          {editing && (
            <InvestmentForm
              onSubmit={saveInvestment}
              defaults={editing}
              isEdit
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Value history dialog */}
      <Dialog
        open={!!historyFor}
        onOpenChange={(open) => {
          if (!open) {
            setHistoryFor(null);
            setHistory([]);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Value History — {historyFor?.name}
            </DialogTitle>
          </DialogHeader>
          {history.length > 0 ? (
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 font-medium">Date</th>
                    <th className="py-2 font-medium text-right">Value</th>
                    {historyFor?.currency !== "NZD" && (
                      <th className="py-2 font-medium text-right">Rate</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id} className="border-b last:border-0">
                      <td className="py-2">
                        {new Date(h.recorded_at).toLocaleDateString("en-NZ")}
                      </td>
                      <td className="py-2 text-right font-medium">
                        {fmt(h.value)}
                      </td>
                      {historyFor?.currency !== "NZD" && (
                        <td className="py-2 text-right text-muted-foreground">
                          {h.nzd_rate}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No value history recorded yet.
            </p>
          )}
        </DialogContent>
      </Dialog>

      {/* Import Sharesies dialog */}
      <Dialog
        open={showImport}
        onOpenChange={(open) => {
          if (!open) {
            setShowImport(false);
            setImportPreview(null);
            setImportCsv(null);
            setImportError(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import from Sharesies</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Export an <strong>Investment Holdings Report (CSV)</strong> from
            Sharesies and upload it here.
          </p>
          <Input
            type="file"
            accept=".csv"
            onChange={handleImportFile}
          />
          {importError && (
            <p className="text-sm text-red-600">{importError}</p>
          )}
          {importPreview && (
            <>
              <div className="max-h-60 overflow-y-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left bg-muted/50">
                      <th className="py-2 px-3 font-medium">Name</th>
                      <th className="py-2 px-3 font-medium text-right">Value</th>
                      <th className="py-2 px-3 font-medium text-right">Cost</th>
                      <th className="py-2 px-3 font-medium text-right">Units</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.map((h, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2 px-3">
                          {h.name}
                          {h.ticker && (
                            <span className="text-xs text-muted-foreground ml-1">
                              ({h.ticker})
                            </span>
                          )}
                          {h.currency !== "NZD" && (
                            <Badge variant="outline" className="ml-1 text-xs">
                              {h.currency}
                            </Badge>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-medium">
                          {fmt(h.current_value)}
                        </td>
                        <td className="py-2 px-3 text-right text-muted-foreground">
                          {fmt(h.cost_basis)}
                        </td>
                        <td className="py-2 px-3 text-right text-muted-foreground">
                          {h.units ? h.units.toFixed(4) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-sm text-muted-foreground">
                {importPreview.length} holding{importPreview.length !== 1 ? "s" : ""} will be imported
              </p>
              <Button onClick={confirmImport} disabled={importing}>
                {importing ? "Importing..." : `Import ${importPreview.length} Holdings`}
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
