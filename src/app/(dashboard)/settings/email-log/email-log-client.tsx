"use client";

import { useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Entry = {
  id: string;
  sent_at: string;
  kind: string;
  provider: string;
  from_address: string | null;
  to_address: string;
  cc_addresses: string[] | null;
  subject: string;
  attachment_names: string[] | null;
  success: boolean;
  error_message: string | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
};

const KIND_LABELS: Record<string, string> = {
  invoice: "Invoice",
  timesheet: "Timesheet",
  payslip: "Payslip",
  notification: "Notification",
  other: "Other",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-NZ", {
    timeZone: "Pacific/Auckland",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function EmailLogClient({ initialEntries }: { initialEntries: Entry[] }) {
  const [entries, setEntries] = useState(initialEntries);
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Entry | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (kindFilter !== "all" && e.kind !== kindFilter) return false;
      if (!s) return true;
      return (
        e.to_address.toLowerCase().includes(s) ||
        e.subject.toLowerCase().includes(s) ||
        (e.cc_addresses?.some((c) => c.toLowerCase().includes(s)) ?? false)
      );
    });
  }, [entries, kindFilter, search]);

  async function refresh() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/email-log?limit=200");
      const data = await res.json();
      setEntries(data.entries ?? []);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Email Log</h1>
          <p className="text-sm text-muted-foreground">
            Every email the app has sent — invoices, timesheets, payslips, and
            scheduled notifications.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing}>
          {refreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">
              {filtered.length} of {entries.length} entries
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={kindFilter} onValueChange={(v) => setKindFilter(v ?? "all")}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="invoice">Invoices</SelectItem>
                  <SelectItem value="timesheet">Timesheets</SelectItem>
                  <SelectItem value="payslip">Payslips</SelectItem>
                  <SelectItem value="notification">Notifications</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="Search subject / address..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-[220px]"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No emails yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sent</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(e.sent_at)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{KIND_LABELS[e.kind] ?? e.kind}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{e.to_address}</TableCell>
                    <TableCell className="text-sm max-w-[320px] truncate">
                      {e.subject}
                    </TableCell>
                    <TableCell>
                      {e.success ? (
                        <Badge variant="default" className="bg-green-600 hover:bg-green-600 dark:bg-green-700">
                          Sent
                        </Badge>
                      ) : (
                        <Badge variant="destructive">Failed</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setSelected(e)}>
                        Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selected && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <CardTitle className="text-base">Email details</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[140px,1fr] gap-y-2 gap-x-4 text-sm">
              <dt className="text-muted-foreground">Sent</dt>
              <dd>{formatDate(selected.sent_at)}</dd>

              <dt className="text-muted-foreground">Type</dt>
              <dd>{KIND_LABELS[selected.kind] ?? selected.kind}</dd>

              <dt className="text-muted-foreground">Provider</dt>
              <dd className="font-mono text-xs">{selected.provider}</dd>

              {selected.from_address && (
                <>
                  <dt className="text-muted-foreground">From</dt>
                  <dd className="font-mono text-xs">{selected.from_address}</dd>
                </>
              )}

              <dt className="text-muted-foreground">To</dt>
              <dd className="font-mono text-xs">{selected.to_address}</dd>

              {selected.cc_addresses && selected.cc_addresses.length > 0 && (
                <>
                  <dt className="text-muted-foreground">CC</dt>
                  <dd className="font-mono text-xs">
                    {selected.cc_addresses.join(", ")}
                  </dd>
                </>
              )}

              <dt className="text-muted-foreground">Subject</dt>
              <dd>{selected.subject}</dd>

              {selected.attachment_names && selected.attachment_names.length > 0 && (
                <>
                  <dt className="text-muted-foreground">Attachments</dt>
                  <dd className="font-mono text-xs">
                    {selected.attachment_names.join(", ")}
                  </dd>
                </>
              )}

              <dt className="text-muted-foreground">Status</dt>
              <dd>
                {selected.success ? (
                  <span className="text-green-700 dark:text-green-400">Sent successfully</span>
                ) : (
                  <span className="text-red-600 dark:text-red-400">
                    Failed — {selected.error_message ?? "unknown error"}
                  </span>
                )}
              </dd>

              {selected.related_entity_type && (
                <>
                  <dt className="text-muted-foreground">Related to</dt>
                  <dd className="text-xs">
                    {selected.related_entity_type}
                    {selected.related_entity_id ? ` (${selected.related_entity_id.slice(0, 8)})` : ""}
                  </dd>
                </>
              )}
            </dl>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
