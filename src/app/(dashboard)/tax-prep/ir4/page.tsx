"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Check } from "lucide-react";

type AddBack = {
  accountName: string;
  amount: number;
  reason: string;
  suggested: boolean;
};

type ShareholderRemuneration = {
  name: string;
  salary: number;
  dividend: number;
};

type IR4Data = {
  grossIncome: number;
  totalExpenses: number;
  netProfitBeforeAdjustments: number;
  addBacks: AddBack[];
  totalAddBacks: number;
  depreciationDeduction: number | null;
  homeOfficeDeduction: number | null;
  vehicleDeduction: number | null;
  totalDeductions: number;
  taxableIncome: number;
  taxRate: number;
  taxPayable: number;
  lossCarriedForward: number;
  shareholderRemuneration: ShareholderRemuneration[];
  provisionalTaxPaid: number;
  rwtDeducted: number;
};

function IR4Row({
  label,
  value,
  box,
  bold,
  negative,
}: {
  label: string;
  value: number;
  box?: number;
  bold?: boolean;
  negative?: boolean;
}) {
  const fmtVal = value.toLocaleString("en-NZ", { minimumFractionDigits: 2 });
  const display = negative ? `(${fmtVal})` : fmtVal;

  return (
    <div className={`flex items-center justify-between ${bold ? "font-medium" : ""}`}>
      <div className="flex items-center gap-2">
        {box && (
          <Badge variant="outline" className="w-10 justify-center text-xs">
            {box}
          </Badge>
        )}
        <span>{label}</span>
      </div>
      <div className="flex items-center gap-1">
        <span>${display}</span>
        <CopyButton value={fmtVal} />
      </div>
    </div>
  );
}

export default function IR4Page() {
  const [data, setData] = useState<IR4Data | null>(null);
  const [marking, setMarking] = useState(false);
  const [filed, setFiled] = useState(false);

  useEffect(() => {
    fetch("/api/tax-prep/ir4")
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data) return <div>Loading...</div>;

  const fmt = (n: number) =>
    "$" + n.toLocaleString("en-NZ", { minimumFractionDigits: 2 });

  const totalCredits = data.provisionalTaxPaid + data.rwtDeducted;
  const residualTax = Math.max(
    0,
    Math.round((data.taxPayable - totalCredits) * 100) / 100
  );

  async function markFiled() {
    setMarking(true);
    await fetch("/api/filing-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filing_type: "ir4",
        period_key: new Date().getFullYear().toString(),
        status: "filed",
        filed_date: new Date().toISOString().slice(0, 10),
        data_snapshot: {
          grossIncome: data!.grossIncome,
          taxableIncome: data!.taxableIncome,
          taxPayable: data!.taxPayable,
        },
      }),
    });
    setFiled(true);
    setMarking(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">IR4 — Company Tax Return Worksheet</h1>
          <p className="text-muted-foreground">
            Review and adjust before filing
          </p>
        </div>
        {filed && (
          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
            Filed
          </Badge>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profit & Loss Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <IR4Row label="Gross Income" value={data.grossIncome} box={20} />
          <IR4Row
            label="Total Expenses"
            value={data.totalExpenses}
            box={22}
            negative
          />
          <div className="border-t pt-2">
            <IR4Row
              label="Net Profit Before Adjustments"
              value={data.netProfitBeforeAdjustments}
              box={25}
              bold
            />
          </div>
        </CardContent>
      </Card>

      {data.shareholderRemuneration.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Shareholder Remuneration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.shareholderRemuneration.map((sh, i) => (
              <div key={i} className="space-y-1">
                <p className="font-medium">{sh.name}</p>
                <div className="ml-4 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="w-12 justify-center text-xs">
                        21A
                      </Badge>
                      <span>Salary</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span>{fmt(sh.salary)}</span>
                      <CopyButton
                        value={sh.salary.toLocaleString("en-NZ", {
                          minimumFractionDigits: 2,
                        })}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="w-12 justify-center text-xs">
                        21B
                      </Badge>
                      <span>Dividends</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span>{fmt(sh.dividend)}</span>
                      <CopyButton
                        value={sh.dividend.toLocaleString("en-NZ", {
                          minimumFractionDigits: 2,
                        })}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Add-Backs (Non-Deductible Expenses)</CardTitle>
        </CardHeader>
        <CardContent>
          {data.addBacks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No add-backs identified
            </p>
          ) : (
            <div className="space-y-2 text-sm">
              {data.addBacks.map((ab, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">{ab.accountName}</span>
                    <span className="ml-2 text-muted-foreground">
                      — {ab.reason}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span>{fmt(ab.amount)}</span>
                    <CopyButton
                      value={ab.amount.toLocaleString("en-NZ", {
                        minimumFractionDigits: 2,
                      })}
                    />
                  </div>
                </div>
              ))}
              <div className="flex justify-between border-t pt-2 font-medium">
                <span>Total Add-Backs</span>
                <div className="flex items-center gap-1">
                  <span>{fmt(data.totalAddBacks)}</span>
                  <CopyButton
                    value={data.totalAddBacks.toLocaleString("en-NZ", {
                      minimumFractionDigits: 2,
                    })}
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Deductions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span>Depreciation</span>
            {data.depreciationDeduction != null ? (
              <div className="flex items-center gap-1">
                <span>{fmt(data.depreciationDeduction)}</span>
                <CopyButton
                  value={data.depreciationDeduction.toLocaleString("en-NZ", {
                    minimumFractionDigits: 2,
                  })}
                />
              </div>
            ) : (
              <span className="flex items-center gap-2">
                Not yet calculated <Badge variant="outline">Pending</Badge>
              </span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span>Home Office</span>
            {data.homeOfficeDeduction != null ? (
              <div className="flex items-center gap-1">
                <span>{fmt(data.homeOfficeDeduction)}</span>
                <CopyButton
                  value={data.homeOfficeDeduction.toLocaleString("en-NZ", {
                    minimumFractionDigits: 2,
                  })}
                />
              </div>
            ) : (
              <span className="flex items-center gap-2">
                Not yet calculated <Badge variant="outline">Pending</Badge>
              </span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span>Motor Vehicle</span>
            {data.vehicleDeduction != null ? (
              <div className="flex items-center gap-1">
                <span>{fmt(data.vehicleDeduction)}</span>
                <CopyButton
                  value={data.vehicleDeduction.toLocaleString("en-NZ", {
                    minimumFractionDigits: 2,
                  })}
                />
              </div>
            ) : (
              <span className="flex items-center gap-2">
                Not yet calculated <Badge variant="outline">Pending</Badge>
              </span>
            )}
          </div>
          <div className="flex justify-between border-t pt-2 font-medium">
            <span>Total Deductions</span>
            <div className="flex items-center gap-1">
              <span>{fmt(data.totalDeductions)}</span>
              <CopyButton
                value={data.totalDeductions.toLocaleString("en-NZ", {
                  minimumFractionDigits: 2,
                })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tax Calculation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <IR4Row label="Taxable Income" value={data.taxableIncome} box={29} bold />
          <div className="flex items-center justify-between">
            <span>Tax Rate</span>
            <span>{(data.taxRate * 100).toFixed(0)}%</span>
          </div>
          <div className="border-t pt-2">
            <IR4Row label="Tax Payable" value={data.taxPayable} box={30} bold />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tax Credits</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <IR4Row label="Provisional Tax Paid" value={data.provisionalTaxPaid} box={31} />
          <IR4Row label="RWT Deducted" value={data.rwtDeducted} box={32} />
          <div className="flex justify-between border-t pt-2 font-medium">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="w-10 justify-center text-xs">
                33
              </Badge>
              <span>Total Credits</span>
            </div>
            <div className="flex items-center gap-1">
              <span>{fmt(totalCredits)}</span>
              <CopyButton
                value={totalCredits.toLocaleString("en-NZ", {
                  minimumFractionDigits: 2,
                })}
              />
            </div>
          </div>
          <div className="flex justify-between border-t pt-2 text-lg font-bold">
            <span>Residual Income Tax</span>
            <div className="flex items-center gap-1">
              <span className={residualTax > 0 ? "text-red-600" : "text-green-600"}>
                {fmt(residualTax)}
              </span>
              <CopyButton
                value={residualTax.toLocaleString("en-NZ", {
                  minimumFractionDigits: 2,
                })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {!filed && (
        <div className="flex justify-end">
          <Button onClick={markFiled} disabled={marking}>
            <Check className="mr-2 h-4 w-4" />
            {marking ? "Saving..." : "Mark as Filed"}
          </Button>
        </div>
      )}
    </div>
  );
}
