"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link2 } from "lucide-react";
import { formatDateNzDash } from "@/lib/utils/format-date-nz";

type ApprovedEntry = {
  id: string;
  date: string;
  duration_minutes: number;
  hourly_rate: number | null;
  description: string | null;
  billable: boolean;
  status: string;
  invoice_id: string | null;
  work_contract_id: string;
  client_name: string;
};

type Props = {
  invoiceId: string;
  invoiceNumber: string;
  onLinked: () => void;
};

const fmt = (n: number) =>
  "$" + n.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function earningsFor(e: ApprovedEntry): number {
  return ((e.hourly_rate ?? 0) * e.duration_minutes) / 60;
}

export function LinkTimesheetsDialog({ invoiceId, invoiceNumber, onLinked }: Props) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<ApprovedEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [contractFilter, setContractFilter] = useState<string>("all");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setSelected(new Set());
      setError(null);
      setLoading(true);
      fetch("/api/timesheets?status=approved")
        .then((r) => r.json())
        .then((rows: ApprovedEntry[]) => {
          // Only entries that are billable AND not already linked.
          const eligible = rows.filter((e) => e.billable && !e.invoice_id);
          eligible.sort((a, b) => b.date.localeCompare(a.date));
          setEntries(eligible);
        })
        .catch(() => setError("Could not load timesheet entries"))
        .finally(() => setLoading(false));
    }
  }

  const contracts = useMemo(() => {
    const seen = new Map<string, string>();
    for (const e of entries) {
      if (!seen.has(e.work_contract_id)) seen.set(e.work_contract_id, e.client_name);
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [entries]);

  const visible = useMemo(() => {
    if (contractFilter === "all") return entries;
    return entries.filter((e) => e.work_contract_id === contractFilter);
  }, [entries, contractFilter]);

  const totals = useMemo(() => {
    let hours = 0;
    let dollars = 0;
    let count = 0;
    for (const e of entries) {
      if (selected.has(e.id)) {
        hours += e.duration_minutes / 60;
        dollars += earningsFor(e);
        count += 1;
      }
    }
    return {
      hours: Math.round(hours * 10) / 10,
      dollars: Math.round(dollars * 100) / 100,
      count,
    };
  }, [entries, selected]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = visible.every((e) => next.has(e.id));
      if (allSelected) {
        for (const e of visible) next.delete(e.id);
      } else {
        for (const e of visible) next.add(e.id);
      }
      return next;
    });
  }

  async function submit() {
    if (selected.size === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/link-timesheets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entry_ids: Array.from(selected) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Link failed");
      setOpen(false);
      onLinked();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Link failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline" />}>
        <Link2 className="mr-2 h-4 w-4" />
        Link timesheets
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Link timesheet entries to {invoiceNumber}</DialogTitle>
          <DialogDescription>
            Pick the approved timesheet entries this invoice covered. They&rsquo;ll be marked as
            invoiced and stop showing under &ldquo;Money Waiting → Uninvoiced work&rdquo;.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor="contract-filter" className="text-xs text-muted-foreground">
                Filter by contract
              </label>
              <select
                id="contract-filter"
                value={contractFilter}
                onChange={(e) => setContractFilter(e.target.value)}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="all">All ({entries.length})</option>
                {contracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-muted-foreground">
              Showing {visible.length} approved billable {visible.length === 1 ? "entry" : "entries"}
            </p>
          </div>

          <div className="max-h-96 overflow-y-auto rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      checked={visible.length > 0 && visible.every((e) => selected.has(e.id))}
                      onChange={toggleAllVisible}
                      aria-label="Select all visible"
                    />
                  </TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Earnings</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-sm text-muted-foreground py-6 text-center">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : visible.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-sm text-muted-foreground py-6 text-center">
                      No approved billable entries available to link.
                    </TableCell>
                  </TableRow>
                ) : (
                  visible.map((e) => (
                    <TableRow
                      key={e.id}
                      data-state={selected.has(e.id) ? "selected" : undefined}
                      onClick={() => toggle(e.id)}
                      className="cursor-pointer"
                    >
                      <TableCell onClick={(ev) => ev.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.has(e.id)}
                          onChange={() => toggle(e.id)}
                          aria-label={`Select ${e.date}`}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{formatDateNzDash(e.date)}</TableCell>
                      <TableCell>{e.client_name}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {(e.duration_minutes / 60).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {e.hourly_rate ? fmt(e.hourly_rate) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmt(earningsFor(e))}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between border-t pt-3 text-sm">
            <div className="text-muted-foreground">
              Selected: <span className="font-medium text-foreground">{totals.count}</span>{" "}
              {totals.count === 1 ? "entry" : "entries"} · {totals.hours}h
            </div>
            <div className="font-semibold tabular-nums">{fmt(totals.dollars)}</div>
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={submitting || selected.size === 0}>
              {submitting ? "Linking…" : `Link ${totals.count} ${totals.count === 1 ? "entry" : "entries"}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
