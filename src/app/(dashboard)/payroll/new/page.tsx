"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Calculator } from "lucide-react";

type Employee = {
  id: string;
  name: string;
  pay_type: string;
  pay_rate: number;
  hours_per_week: number;
  tax_code: string;
  kiwisaver_enrolled: boolean;
  is_active: boolean;
};

type PayRunLine = {
  id: string;
  employee_id: string;
  hours: number | null;
  pay_rate: number;
  gross_pay: number;
  paye: number;
  kiwisaver_employee: number;
  kiwisaver_employer: number;
  esct: number;
  student_loan: number;
  net_pay: number;
  tax_code: string;
};

type PayRunResult = {
  id: string;
  lines: PayRunLine[];
  status: string;
};

const fmt = (n: number) =>
  "$" + n.toLocaleString("en-NZ", { minimumFractionDigits: 2 });

export default function NewPayRunPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [frequency, setFrequency] = useState("fortnightly");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [payDate, setPayDate] = useState("");
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [payRun, setPayRun] = useState<PayRunResult | null>(null);
  const [creating, setCreating] = useState(false);
  const [finalising, setFinalising] = useState(false);

  useEffect(() => {
    fetch("/api/employees")
      .then((r) => r.json())
      .then((data) => {
        const active = data.filter((e: Employee) => e.is_active);
        setEmployees(active);
        setSelectedEmployees(new Set(active.map((e: Employee) => e.id)));
      });
  }, []);

  useEffect(() => {
    const today = new Date();
    const end = new Date(today);
    const start = new Date(today);
    start.setDate(start.getDate() - (frequency === "weekly" ? 6 : 13));
    setPeriodStart(start.toISOString().slice(0, 10));
    setPeriodEnd(end.toISOString().slice(0, 10));
    setPayDate(end.toISOString().slice(0, 10));
  }, [frequency]);

  async function handleCreate() {
    if (!periodStart || !periodEnd || !payDate || selectedEmployees.size === 0) return;
    setCreating(true);
    const res = await fetch("/api/payroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        period_start: periodStart,
        period_end: periodEnd,
        pay_date: payDate,
        frequency,
        employee_ids: Array.from(selectedEmployees),
      }),
    });
    if (res.ok) {
      setPayRun(await res.json());
    }
    setCreating(false);
  }

  async function handleFinalise() {
    if (!payRun) return;
    if (!confirm("Finalise this pay run? This cannot be undone.")) return;
    setFinalising(true);
    const res = await fetch(`/api/payroll/${payRun.id}/finalise`, { method: "POST" });
    if (res.ok) {
      router.push(`/payroll/${payRun.id}`);
    } else {
      const err = await res.json();
      alert(err.error || "Failed to finalise");
      setFinalising(false);
    }
  }

  const totals = payRun?.lines.reduce(
    (acc, l) => ({
      gross: acc.gross + l.gross_pay,
      paye: acc.paye + l.paye,
      ksEmp: acc.ksEmp + l.kiwisaver_employee,
      ksEr: acc.ksEr + l.kiwisaver_employer,
      esct: acc.esct + l.esct,
      sl: acc.sl + l.student_loan,
      net: acc.net + l.net_pay,
    }),
    { gross: 0, paye: 0, ksEmp: 0, ksEr: 0, esct: 0, sl: 0, net: 0 }
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/payroll">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">New Pay Run</h1>
          <p className="text-muted-foreground">Calculate and review before finalising</p>
        </div>
      </div>

      {!payRun ? (
        <Card>
          <CardHeader><CardTitle className="text-lg">Pay Run Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Frequency</Label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="weekly">Weekly</option>
                  <option value="fortnightly">Fortnightly</option>
                </select>
              </div>
              <div>
                <Label>Pay Date</Label>
                <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Period Start</Label>
                <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
              </div>
              <div>
                <Label>Period End</Label>
                <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
              </div>
            </div>

            <div>
              <Label>Employees</Label>
              <div className="space-y-2 mt-2">
                {employees.map((emp) => (
                  <label key={emp.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedEmployees.has(emp.id)}
                      onChange={(e) => {
                        const next = new Set(selectedEmployees);
                        e.target.checked ? next.add(emp.id) : next.delete(emp.id);
                        setSelectedEmployees(next);
                      }}
                    />
                    {emp.name} — {emp.pay_type === "salary" ? fmt(emp.pay_rate) + "/yr" : fmt(emp.pay_rate) + "/hr"} ({emp.tax_code})
                  </label>
                ))}
              </div>
            </div>

            <Button onClick={handleCreate} disabled={creating || selectedEmployees.size === 0}>
              <Calculator className="mr-2 h-4 w-4" />
              {creating ? "Calculating..." : "Calculate Pay Run"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader><CardTitle className="text-lg">Pay Run Preview</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">PAYE</TableHead>
                    <TableHead className="text-right">KiwiSaver</TableHead>
                    <TableHead className="text-right">Student Loan</TableHead>
                    <TableHead className="text-right">Net Pay</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payRun.lines.map((line) => {
                    const emp = employees.find((e) => e.id === line.employee_id);
                    return (
                      <TableRow key={line.id}>
                        <TableCell>{emp?.name ?? "Unknown"}</TableCell>
                        <TableCell className="text-right">{fmt(line.gross_pay)}</TableCell>
                        <TableCell className="text-right">{fmt(line.paye)}</TableCell>
                        <TableCell className="text-right">{fmt(line.kiwisaver_employee)}</TableCell>
                        <TableCell className="text-right">{fmt(line.student_loan)}</TableCell>
                        <TableCell className="text-right font-semibold text-green-600">{fmt(line.net_pay)}</TableCell>
                      </TableRow>
                    );
                  })}
                  {totals && (
                    <TableRow className="font-semibold border-t-2">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right">{fmt(totals.gross)}</TableCell>
                      <TableCell className="text-right">{fmt(totals.paye)}</TableCell>
                      <TableCell className="text-right">{fmt(totals.ksEmp)}</TableCell>
                      <TableCell className="text-right">{fmt(totals.sl)}</TableCell>
                      <TableCell className="text-right text-green-600">{fmt(totals.net)}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {totals && totals.ksEr > 0 && (
                <div className="mt-4 text-sm text-muted-foreground">
                  Employer KiwiSaver: {fmt(totals.ksEr)} (ESCT: {fmt(totals.esct)}, net: {fmt(totals.ksEr - totals.esct)})
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button onClick={handleFinalise} disabled={finalising}>
              {finalising ? "Finalising..." : "Finalise Pay Run"}
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                await fetch(`/api/payroll/${payRun.id}`, { method: "DELETE" });
                setPayRun(null);
              }}
            >
              Discard
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
