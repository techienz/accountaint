"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Download, Trash2 } from "lucide-react";

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

type PayRun = {
  id: string;
  period_start: string;
  period_end: string;
  pay_date: string;
  frequency: string;
  status: string;
  lines: PayRunLine[];
};

const fmt = (n: number) =>
  "$" + n.toLocaleString("en-NZ", { minimumFractionDigits: 2 });

export default function PayRunDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [payRun, setPayRun] = useState<PayRun | null>(null);
  const [employees, setEmployees] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch(`/api/payroll/${params.id}`).then((r) => r.json()).then(setPayRun);
    fetch("/api/employees")
      .then((r) => r.json())
      .then((data: { id: string; name: string }[]) => {
        const map: Record<string, string> = {};
        for (const e of data) map[e.id] = e.name;
        setEmployees(map);
      });
  }, [params.id]);

  if (!payRun) return <div>Loading...</div>;

  const totals = payRun.lines.reduce(
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
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Pay Run — {payRun.pay_date}</h1>
            <Badge variant={payRun.status === "finalised" ? "default" : "outline"}>
              {payRun.status === "finalised" ? "Finalised" : "Draft"}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            {payRun.period_start} to {payRun.period_end} ({payRun.frequency})
          </p>
        </div>
        {payRun.status === "draft" && (
          <Button
            variant="destructive"
            size="sm"
            onClick={async () => {
              if (!confirm("Delete this draft pay run?")) return;
              await fetch(`/api/payroll/${payRun.id}`, { method: "DELETE" });
              router.push("/payroll");
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" />Delete
          </Button>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Pay Summary</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Tax Code</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">PAYE</TableHead>
                <TableHead className="text-right">KiwiSaver</TableHead>
                <TableHead className="text-right">Student Loan</TableHead>
                <TableHead className="text-right">Net Pay</TableHead>
                {payRun.status === "finalised" && <TableHead></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {payRun.lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell>{employees[line.employee_id] || "Unknown"}</TableCell>
                  <TableCell>{line.tax_code}</TableCell>
                  <TableCell className="text-right">{fmt(line.gross_pay)}</TableCell>
                  <TableCell className="text-right">{fmt(line.paye)}</TableCell>
                  <TableCell className="text-right">{fmt(line.kiwisaver_employee)}</TableCell>
                  <TableCell className="text-right">{fmt(line.student_loan)}</TableCell>
                  <TableCell className="text-right font-semibold text-green-600">{fmt(line.net_pay)}</TableCell>
                  {payRun.status === "finalised" && (
                    <TableCell>
                      <a
                        href={`/api/payroll/${payRun.id}/payslip/${line.employee_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <Download className="h-3 w-3" />Payslip
                      </a>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              <TableRow className="font-semibold border-t-2">
                <TableCell>Total</TableCell>
                <TableCell></TableCell>
                <TableCell className="text-right">{fmt(totals.gross)}</TableCell>
                <TableCell className="text-right">{fmt(totals.paye)}</TableCell>
                <TableCell className="text-right">{fmt(totals.ksEmp)}</TableCell>
                <TableCell className="text-right">{fmt(totals.sl)}</TableCell>
                <TableCell className="text-right text-green-600">{fmt(totals.net)}</TableCell>
                {payRun.status === "finalised" && <TableCell></TableCell>}
              </TableRow>
            </TableBody>
          </Table>

          {totals.ksEr > 0 && (
            <div className="mt-4 text-sm text-muted-foreground">
              Employer KiwiSaver: {fmt(totals.ksEr)} | ESCT: {fmt(totals.esct)} | Net employer contribution: {fmt(totals.ksEr - totals.esct)}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
