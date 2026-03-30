"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Check } from "lucide-react";

type Instalment = {
  number: number;
  dueDate: string;
  amountDue: number;
  amountPaid: number | null;
  paidDate: string | null;
};

type Schedule = {
  method: string;
  taxYear: number;
  instalments: Instalment[];
  totalDue: number;
  totalPaid: number;
  balance: number;
};

type ProvisionalData = {
  configured: boolean;
  message?: string;
  schedule?: Schedule;
  priorYearRIT?: number;
};

const methodLabels: Record<string, string> = {
  standard: "Standard (prior year + 5%)",
  estimation: "Estimation",
  aim: "AIM (Accounting Income Method)",
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-NZ", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function ProvisionalTaxPage() {
  const [data, setData] = useState<ProvisionalData | null>(null);
  const [payingIndex, setPayingIndex] = useState<number | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  function loadData() {
    fetch("/api/tax-prep/provisional")
      .then((r) => r.json())
      .then(setData);
  }

  useEffect(() => {
    loadData();
  }, []);

  if (!data) return <div>Loading...</div>;

  if (!data.configured) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Provisional Tax</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{data.message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const schedule = data.schedule!;
  const fmt = (n: number) =>
    "$" + n.toLocaleString("en-NZ", { minimumFractionDigits: 2 });
  const fmtRaw = (n: number) =>
    n.toLocaleString("en-NZ", { minimumFractionDigits: 2 });

  async function recordPayment(inst: Instalment) {
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) return;

    await fetch("/api/tax-prep/provisional", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tax_year: schedule.taxYear,
        instalment_number: inst.number,
        due_date: inst.dueDate,
        amount_due: inst.amountDue,
        amount_paid: amount,
        paid_date: payDate,
      }),
    });
    setPayingIndex(null);
    setPayAmount("");
    loadData();
  }

  const now = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Provisional Tax</h1>
        <p className="text-muted-foreground">
          {schedule.taxYear} tax year —{" "}
          {methodLabels[schedule.method] || schedule.method}
        </p>
      </div>

      {data.priorYearRIT != null && data.priorYearRIT > 0 && (
        <Card>
          <CardContent className="flex items-center justify-between py-4 text-sm">
            <span>Prior year residual income tax (RIT)</span>
            <div className="flex items-center gap-1">
              <span>{fmt(data.priorYearRIT)}</span>
              <CopyButton value={fmtRaw(data.priorYearRIT)} />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Instalment Schedule</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0 divide-y text-sm">
          {schedule.instalments.map((inst) => {
            const isPaid = inst.amountPaid != null;
            const isOverdue = !isPaid && inst.dueDate < now;
            const isPayingThis = payingIndex === inst.number;

            return (
              <div key={inst.number} className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="w-8 justify-center">
                      P{inst.number}
                    </Badge>
                    <div>
                      <p className="font-medium">
                        Instalment {inst.number}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Due {formatDate(inst.dueDate)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="flex items-center gap-1">
                        <span>{fmt(inst.amountDue)}</span>
                        <CopyButton value={fmtRaw(inst.amountDue)} />
                      </div>
                      {isPaid && (
                        <p className="text-xs text-green-600">
                          Paid {fmt(inst.amountPaid!)}
                          {inst.paidDate && ` on ${inst.paidDate}`}
                        </p>
                      )}
                    </div>
                    {isPaid ? (
                      <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                        Paid
                      </Badge>
                    ) : isOverdue ? (
                      <Badge variant="destructive">Overdue</Badge>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setPayingIndex(inst.number);
                          setPayAmount(String(inst.amountDue));
                        }}
                      >
                        Record
                      </Button>
                    )}
                  </div>
                </div>
                {isPayingThis && (
                  <div className="mt-3 flex items-end gap-2 pl-11">
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">
                        Amount
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                        className="h-8 w-32 rounded border px-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">
                        Date
                      </label>
                      <input
                        type="date"
                        value={payDate}
                        onChange={(e) => setPayDate(e.target.value)}
                        className="h-8 rounded border px-2 text-sm"
                      />
                    </div>
                    <Button size="sm" onClick={() => recordPayment(inst)}>
                      <Check className="mr-1 h-3 w-3" /> Save
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPayingIndex(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 py-4 text-sm">
          <div className="flex justify-between">
            <span>Total Due</span>
            <div className="flex items-center gap-1">
              <span>{fmt(schedule.totalDue)}</span>
              <CopyButton value={fmtRaw(schedule.totalDue)} />
            </div>
          </div>
          <div className="flex justify-between text-green-600">
            <span>Total Paid</span>
            <span>{fmt(schedule.totalPaid)}</span>
          </div>
          <div className="flex justify-between border-t pt-2 font-medium">
            <span>Balance Remaining</span>
            <span className={schedule.balance > 0 ? "text-red-600" : "text-green-600"}>
              {fmt(schedule.balance)}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
