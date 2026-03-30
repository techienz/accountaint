"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Summary = {
  totalHours: number;
  billableHours: number;
  nonBillableHours: number;
  billableRatio: number;
  totalEarnings: number;
  byClient: { clientName: string; hours: number; earnings: number }[];
};

export default function TimesheetSummaryPage() {
  const now = new Date();
  const [dateFrom, setDateFrom] = useState(
    new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  );
  const [dateTo, setDateTo] = useState(now.toISOString().slice(0, 10));
  const [summary, setSummary] = useState<Summary | null>(null);

  function loadSummary() {
    fetch(`/api/timesheets/summary?date_from=${dateFrom}&date_to=${dateTo}`)
      .then((r) => r.json())
      .then(setSummary);
  }

  useEffect(() => {
    loadSummary();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fmt = (n: number) =>
    "$" + n.toLocaleString("en-NZ", { minimumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Timesheet Summary</h1>

      <div className="flex items-end gap-4">
        <div>
          <Label htmlFor="date_from">From</Label>
          <Input
            id="date_from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="date_to">To</Label>
          <Input
            id="date_to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
        <Button onClick={loadSummary}>Update</Button>
      </div>

      {summary && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{summary.totalHours}</p>
                <p className="text-xs text-muted-foreground">
                  {summary.billableHours} billable, {summary.nonBillableHours} non-billable
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Billable Ratio</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{summary.billableRatio}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{fmt(summary.totalEarnings)}</p>
              </CardContent>
            </Card>
          </div>

          {summary.byClient.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">By Client</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                      <TableHead className="text-right">Earnings</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.byClient.map((c) => (
                      <TableRow key={c.clientName}>
                        <TableCell className="font-medium">{c.clientName}</TableCell>
                        <TableCell className="text-right">{c.hours}</TableCell>
                        <TableCell className="text-right">{fmt(c.earnings)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
