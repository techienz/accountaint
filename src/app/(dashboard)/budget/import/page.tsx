"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Upload, FileSpreadsheet, Check } from "lucide-react";

const fmt = (n: number) =>
  "$" + n.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type PreviewData = {
  incomes: { label: string; monthly_amount: number }[];
  recurring: { name: string; monthly_amount: number; due_day: number | null; frequency: string; category: string }[];
  oneOffs: { name: string; amount: number; date: string }[];
  debts: { name: string; balance: number; monthly_repayment: number; interest_rate: number; is_mortgage: boolean }[];
  savings: { name: string; current_balance: number; target_amount: number | null; fortnightly_contribution: number }[];
  holidays: { destination: string; year: number | null; accommodation_cost: number; travel_cost: number; spending_budget: number; other_costs: number }[];
};

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<Record<string, number> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handlePreview() {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("preview", "true");
    const res = await fetch("/api/budget/import", { method: "POST", body: fd });
    const data = await res.json();
    if (data.preview) setPreview(data.data);
  }

  async function handleImport() {
    if (!file) return;
    setImporting(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/budget/import", { method: "POST", body: fd });
    const data = await res.json();
    if (data.success) setResult(data.counts);
    setImporting(false);
  }

  if (result) {
    const total = Object.values(result).reduce((s, n) => s + n, 0);
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Import Complete</h1>
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center gap-2 text-green-600 mb-4">
              <Check className="h-5 w-5" />
              <span className="font-medium">Successfully imported {total} records</span>
            </div>
            {Object.entries(result).map(([key, count]) =>
              count > 0 ? (
                <div key={key} className="flex justify-between text-sm">
                  <span className="capitalize">{key}</span>
                  <span className="font-medium">{count}</span>
                </div>
              ) : null
            )}
            <div className="pt-4">
              <Button onClick={() => window.location.href = "/budget"}>
                Go to Budget
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Import Budget</h1>
        <p className="text-muted-foreground">
          Import your budget from an Excel spreadsheet
        </p>
      </div>

      {/* Upload area */}
      <Card>
        <CardContent className="pt-6">
          <div
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setFile(f);
                  setPreview(null);
                }
              }}
            />
            {file ? (
              <div className="flex items-center justify-center gap-2">
                <FileSpreadsheet className="h-6 w-6 text-green-600" />
                <span className="font-medium">{file.name}</span>
              </div>
            ) : (
              <div>
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Click to upload an Excel file (.xlsx)
                </p>
              </div>
            )}
          </div>
          {file && !preview && (
            <div className="mt-4 flex justify-end">
              <Button onClick={handlePreview}>Preview Data</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview */}
      {preview && (
        <>
          {preview.incomes.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Income Sources ({preview.incomes.length})</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Label</TableHead><TableHead className="text-right">Monthly</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {preview.incomes.map((i, idx) => (
                      <TableRow key={idx}><TableCell>{i.label}</TableCell><TableCell className="text-right">{fmt(i.monthly_amount)}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {preview.recurring.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Recurring Items ({preview.recurring.length})</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="text-right">Monthly</TableHead><TableHead>Due Day</TableHead><TableHead>Category</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {preview.recurring.map((r, idx) => (
                      <TableRow key={idx}><TableCell>{r.name}</TableCell><TableCell className="text-right">{fmt(r.monthly_amount)}</TableCell><TableCell>{r.due_day ?? "—"}</TableCell><TableCell>{r.category}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {preview.debts.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Debts ({preview.debts.length})</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="text-right">Balance</TableHead><TableHead className="text-right">Repayment</TableHead><TableHead className="text-right">Rate</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {preview.debts.map((d, idx) => (
                      <TableRow key={idx}><TableCell>{d.name}</TableCell><TableCell className="text-right">{fmt(d.balance)}</TableCell><TableCell className="text-right">{fmt(d.monthly_repayment)}</TableCell><TableCell className="text-right">{(d.interest_rate * 100).toFixed(2)}%</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {preview.savings.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Savings Goals ({preview.savings.length})</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="text-right">Balance</TableHead><TableHead className="text-right">Target</TableHead><TableHead className="text-right">Fortnightly</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {preview.savings.map((s, idx) => (
                      <TableRow key={idx}><TableCell>{s.name}</TableCell><TableCell className="text-right">{fmt(s.current_balance)}</TableCell><TableCell className="text-right">{s.target_amount ? fmt(s.target_amount) : "—"}</TableCell><TableCell className="text-right">{fmt(s.fortnightly_contribution)}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {preview.holidays.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Holidays ({preview.holidays.length})</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Destination</TableHead><TableHead>Year</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {preview.holidays.map((h, idx) => (
                      <TableRow key={idx}><TableCell>{h.destination}</TableCell><TableCell>{h.year ?? "—"}</TableCell><TableCell className="text-right">{fmt(h.accommodation_cost + h.travel_cost + h.spending_budget + h.other_costs)}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end">
            <Button onClick={handleImport} disabled={importing}>
              {importing ? "Importing..." : "Import All"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
