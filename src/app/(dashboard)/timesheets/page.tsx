"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WeekView } from "@/components/timesheets/week-view";
import { QuickAddForm } from "@/components/timesheets/quick-add-form";
import { EditEntryForm } from "@/components/timesheets/edit-entry-form";
import { ChevronLeft, ChevronRight, Plus, Calendar, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatDateDisplay } from "@/lib/utils/dates";

type Entry = {
  id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number;
  description: string | null;
  billable: boolean;
  status: string;
  client_name: string;
  hourly_rate: number | null;
  work_contract_id: string;
};

type ActiveContract = {
  id: string;
  client_name: string;
  status: string;
};

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function TimesheetsPage() {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [weekData, setWeekData] = useState<Record<string, Entry[]>>({});
  const [contracts, setContracts] = useState<ActiveContract[]>([]);
  const [quickAddDate, setQuickAddDate] = useState<string | null>(null);
  const [summary, setSummary] = useState<{
    totalHours: number;
    billableHours: number;
    totalEarnings: number;
  } | null>(null);
  const [draftIds, setDraftIds] = useState<string[]>([]);
  const [approvedByContract, setApprovedByContract] = useState<
    { contractId: string; clientName: string; count: number }[]
  >([]);
  const [invoicing, setInvoicing] = useState(false);
  const [includeDescriptions, setIncludeDescriptions] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const loadWeek = useCallback(() => {
    const from = formatDate(weekStart);
    const to = formatDate(weekEnd);

    fetch(`/api/timesheets?date_from=${from}&date_to=${to}`)
      .then((r) => r.json())
      .then((entries: Entry[]) => {
        const days: Record<string, Entry[]> = {};
        for (let i = 0; i < 7; i++) {
          const d = new Date(weekStart);
          d.setDate(d.getDate() + i);
          days[formatDate(d)] = [];
        }
        for (const e of entries) {
          if (days[e.date]) days[e.date].push(e);
        }
        setWeekData(days);

        const drafts = entries.filter((e) => e.status === "draft").map((e) => e.id);
        setDraftIds(drafts);

        // Group approved entries by contract for invoicing
        const approved = entries.filter((e) => e.status === "approved");
        const byContract = new Map<string, { clientName: string; count: number }>();
        for (const e of approved) {
          const existing = byContract.get(e.work_contract_id);
          if (existing) {
            existing.count++;
          } else {
            byContract.set(e.work_contract_id, { clientName: e.client_name, count: 1 });
          }
        }
        setApprovedByContract(
          Array.from(byContract.entries()).map(([contractId, v]) => ({
            contractId,
            clientName: v.clientName,
            count: v.count,
          }))
        );

        const totalMins = entries.reduce((s, e) => s + e.duration_minutes, 0);
        const billableMins = entries.filter((e) => e.billable).reduce((s, e) => s + e.duration_minutes, 0);
        const earnings = entries
          .filter((e) => e.billable && e.hourly_rate)
          .reduce((s, e) => s + (e.hourly_rate! * e.duration_minutes / 60), 0);
        setSummary({
          totalHours: Math.round(totalMins / 6) / 10,
          billableHours: Math.round(billableMins / 6) / 10,
          totalEarnings: Math.round(earnings * 100) / 100,
        });
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  useEffect(() => {
    loadWeek();
    fetch("/api/work-contracts")
      .then((r) => r.json())
      .then((data: ActiveContract[]) =>
        setContracts(data.filter((c: { status: string }) => c.status === "active" || c.status === "expiring_soon"))
      );
  }, [loadWeek]);

  function prevWeek() {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  }

  function nextWeek() {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  }

  function jumpToDate(dateStr: string) {
    if (!dateStr) return;
    setWeekStart(getMonday(new Date(dateStr)));
  }

  function goToToday() {
    setWeekStart(getMonday(new Date()));
  }

  async function handleCreateInvoice(contractId: string) {
    setInvoicing(true);
    const res = await fetch("/api/invoices/from-timesheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [{ work_contract_id: contractId, include_descriptions: includeDescriptions }],
      }),
    });
    if (res.ok) {
      loadWeek();
    }
    setInvoicing(false);
  }

  async function handleApproveAll() {
    if (draftIds.length === 0) return;
    await fetch("/api/timesheets/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: draftIds }),
    });
    loadWeek();
  }

  const fmt = (n: number) =>
    "$" + n.toLocaleString("en-NZ", { minimumFractionDigits: 2 });

  const weekLabel = `${formatDate(weekStart)} to ${formatDate(weekEnd)}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Timesheets</h1>
          <p className="text-muted-foreground">
            Track hours worked against your contracts
          </p>
        </div>
        <div className="flex items-center gap-2">
          {contracts.length > 0 && (
            <select
              id="export-contract"
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              defaultValue=""
            >
              <option value="" disabled>Export for...</option>
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>{c.client_name}</option>
              ))}
            </select>
          )}
          {contracts.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const sel = (document.getElementById("export-contract") as HTMLSelectElement)?.value;
                if (!sel) return;
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekEnd.getDate() + 6);
                window.open(`/api/timesheets/export?contract_id=${sel}&week_ending=${formatDate(weekEnd)}`);
              }}
            >
              <Download className="mr-1 h-3.5 w-3.5" />CSV
            </Button>
          )}
          {draftIds.length > 0 && (
            <Button variant="outline" onClick={handleApproveAll}>
              Approve All ({draftIds.length})
            </Button>
          )}
          <Link href="/timesheets/new">
            <Button><Plus className="mr-2 h-4 w-4" />Log Time</Button>
          </Link>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={prevWeek}>
          <ChevronLeft className="h-4 w-4 mr-1" />Prev
        </Button>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Input
              type="date"
              value={formatDate(weekStart)}
              onChange={(e) => jumpToDate(e.target.value)}
              className="w-[160px] text-center text-sm pr-8"
            />
            <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          </div>
          <span className="text-sm text-muted-foreground">to {formatDateDisplay(formatDate(weekEnd))}</span>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
        </div>
        <Button variant="ghost" size="sm" onClick={nextWeek}>
          Next<ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      {summary && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{summary.totalHours}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Billable Hours</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{summary.billableHours}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Earnings This Week</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{fmt(summary.totalEarnings)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <WeekView
        weekData={weekData}
        onDayClick={(date) => { setEditingEntry(null); setQuickAddDate(quickAddDate === date ? null : date); }}
        onEntryClick={(entry) => { setQuickAddDate(null); setEditingEntry(editingEntry?.id === entry.id ? null : entry); }}
      />

      {approvedByContract.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Ready to invoice</p>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={includeDescriptions}
                  onChange={(e) => setIncludeDescriptions(e.target.checked)}
                  className="rounded"
                />
                Include timesheet descriptions
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              {approvedByContract.map((item) => (
                <Button
                  key={item.contractId}
                  variant="outline"
                  size="sm"
                  disabled={invoicing}
                  onClick={() => handleCreateInvoice(item.contractId)}
                >
                  Invoice {item.clientName} ({item.count} entries)
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {quickAddDate && contracts.length > 0 && (
        <QuickAddForm
          date={quickAddDate}
          contracts={contracts}
          onSaved={() => {
            setQuickAddDate(null);
            loadWeek();
          }}
          onCancel={() => setQuickAddDate(null)}
        />
      )}

      {editingEntry && (
        <EditEntryForm
          entry={editingEntry}
          onSaved={() => {
            setEditingEntry(null);
            loadWeek();
          }}
          onCancel={() => setEditingEntry(null)}
          onDelete={() => {
            setEditingEntry(null);
            loadWeek();
          }}
        />
      )}
    </div>
  );
}
