"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CopyButton } from "@/components/ui/copy-button";
import { IncomeSourcesForm } from "@/components/tax-prep/income-sources-form";
import { AlertTriangle, AlertCircle } from "lucide-react";

type BracketDetail = {
  from: number;
  to: number;
  rate: number;
  taxableAmount: number;
  tax: number;
};

type FifData = {
  applies: boolean;
  fifIncome: number;
  totalOpeningValue: number;
  totalCostBasis: number;
  isExempt: boolean;
  holdings: { name: string; openingValue: number; fdrIncome: number }[];
};

type IR3Data = {
  salary: number;
  dividendGross: number;
  imputationCredits: number;
  otherIncome: {
    source_type: string;
    description: string | null;
    amount: number;
    tax_paid: number;
  }[];
  totalOtherIncome: number;
  totalTaxPaid: number;
  totalTaxableIncome: number;
  personalTax: {
    totalTax: number;
    effectiveRate: number;
    bracketBreakdown: BracketDetail[];
  };
  taxToPay: number;
  currentAccount: {
    totalDrawings: number;
    totalRepayments: number;
    totalSalaryRecorded: number;
    totalDividendRecorded: number;
    closingBalance: number;
    isOverdrawn: boolean;
  };
  deemedDividend: {
    applies: boolean;
    maxOverdrawnAmount: number;
    grossedUpAmount: number;
    imputationCredits: number;
    warning: string | null;
  };
  discrepancies: {
    salaryMismatch: boolean;
    dividendMismatch: boolean;
    configSalary: number;
    recordedSalary: number;
    configDividend: number;
    recordedDividend: number;
  } | null;
  fif: FifData | null;
};

function IR3Row({
  label,
  value,
  muted,
}: {
  label: string;
  value: number;
  muted?: boolean;
}) {
  const fmtVal = value.toLocaleString("en-NZ", { minimumFractionDigits: 2 });
  return (
    <div className={`flex items-center justify-between ${muted ? "text-muted-foreground" : ""}`}>
      <span>{label}</span>
      <div className="flex items-center gap-1">
        <span>${fmtVal}</span>
        <CopyButton value={fmtVal} />
      </div>
    </div>
  );
}

export default function IR3Page() {
  const params = useParams<{ shareholderId: string }>();
  const [data, setData] = useState<IR3Data | null>(null);

  function loadData() {
    fetch(`/api/tax-prep/ir3/${params.shareholderId}`)
      .then((r) => r.json())
      .then(setData);
  }

  useEffect(() => {
    loadData();
  }, [params.shareholderId]);

  if (!data) return <div>Loading...</div>;

  const fmt = (n: number) =>
    "$" + n.toLocaleString("en-NZ", { minimumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">IR3 — Personal Tax Worksheet</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Company Income</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <IR3Row label="Shareholder Salary" value={data.salary} />
          <IR3Row label="Dividends (grossed-up)" value={data.dividendGross} />
          <IR3Row label="Imputation Credits" value={data.imputationCredits} muted />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current Account Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <IR3Row label="Total Drawings" value={data.currentAccount.totalDrawings} />
          <IR3Row label="Total Repayments" value={data.currentAccount.totalRepayments} />
          <IR3Row label="Salary Recorded" value={data.currentAccount.totalSalaryRecorded} />
          <IR3Row label="Dividends Recorded" value={data.currentAccount.totalDividendRecorded} />
          <div className="flex justify-between border-t pt-2 font-medium">
            <span>Closing Balance</span>
            <span className={data.currentAccount.isOverdrawn ? "text-red-600" : ""}>
              {fmt(data.currentAccount.closingBalance)}
              {data.currentAccount.isOverdrawn && " (overdrawn)"}
            </span>
          </div>
        </CardContent>
      </Card>

      {data.discrepancies && (
        <Alert variant="default" className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800 dark:text-amber-400">
            Config / Transaction Mismatch
          </AlertTitle>
          <AlertDescription className="text-sm text-amber-700 dark:text-amber-300">
            {data.discrepancies.salaryMismatch && (
              <p>
                Salary config shows {fmt(data.discrepancies.configSalary)} but
                current account transactions total {fmt(data.discrepancies.recordedSalary)}.
              </p>
            )}
            {data.discrepancies.dividendMismatch && (
              <p>
                Dividend config shows {fmt(data.discrepancies.configDividend)} but
                current account transactions total {fmt(data.discrepancies.recordedDividend)}.
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}

      {data.deemedDividend.applies && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Deemed Dividend — CD 4</AlertTitle>
          <AlertDescription className="space-y-1 text-sm">
            <p>
              The shareholder current account was overdrawn by up to{" "}
              {fmt(data.deemedDividend.maxOverdrawnAmount)} during the tax year.
              Under section CD 4, this is treated as a deemed dividend.
            </p>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between">
                <span>Grossed-up deemed dividend</span>
                <span>{fmt(data.deemedDividend.grossedUpAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span>Imputation credits</span>
                <span>{fmt(data.deemedDividend.imputationCredits)}</span>
              </div>
            </div>
            <p className="mt-2 text-xs opacity-80">
              These amounts are already included in the tax calculation below.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {data.fif && data.fif.applies && (
        <Card>
          <CardHeader>
            <CardTitle>Foreign Investment Fund (FIF)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.fif.isExempt ? (
              <p className="text-muted-foreground">
                No FIF income — total foreign investment cost basis is under $50,000
                ({fmt(data.fif.totalCostBasis)}). Exemption applies.
              </p>
            ) : (
              <>
                <p className="mb-3 text-muted-foreground">
                  Fair Dividend Rate (FDR) method — 5% of opening market value
                </p>
                <div className="space-y-1">
                  {data.fif.holdings.map((h, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div>
                        <span>{h.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          (opening: {fmt(h.openingValue)})
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>{fmt(h.fdrIncome)}</span>
                        <CopyButton
                          value={h.fdrIncome.toLocaleString("en-NZ", {
                            minimumFractionDigits: 2,
                          })}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between border-t pt-2 font-medium">
                  <span>Total FIF Income</span>
                  <div className="flex items-center gap-1">
                    <span>{fmt(data.fif.fifIncome)}</span>
                    <CopyButton
                      value={data.fif.fifIncome.toLocaleString("en-NZ", {
                        minimumFractionDigits: 2,
                      })}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  This amount is included in taxable income below.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Other Income Sources</CardTitle>
        </CardHeader>
        <CardContent>
          {data.otherIncome.length > 0 && (
            <div className="mb-4 space-y-2 text-sm">
              {data.otherIncome.map((s, i) => (
                <div key={i} className="flex justify-between">
                  <span>
                    {s.description || s.source_type}
                    {s.tax_paid > 0 && (
                      <span className="text-muted-foreground">
                        {" "}(tax paid: {fmt(s.tax_paid)})
                      </span>
                    )}
                  </span>
                  <span>{fmt(s.amount)}</span>
                </div>
              ))}
            </div>
          )}
          <IncomeSourcesForm
            shareholderId={params.shareholderId}
            onSuccess={loadData}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tax Calculation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center justify-between font-medium">
            <span>Total Taxable Income</span>
            <div className="flex items-center gap-1">
              <span>{fmt(data.totalTaxableIncome)}</span>
              <CopyButton
                value={data.totalTaxableIncome.toLocaleString("en-NZ", {
                  minimumFractionDigits: 2,
                })}
              />
            </div>
          </div>
          {data.deemedDividend.applies && (
            <div className="flex justify-between text-red-600 text-xs">
              <span>Includes deemed dividend (grossed-up)</span>
              <span>{fmt(data.deemedDividend.grossedUpAmount)}</span>
            </div>
          )}
          {data.fif && !data.fif.isExempt && data.fif.fifIncome > 0 && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Includes FIF income (FDR)</span>
              <span>{fmt(data.fif.fifIncome)}</span>
            </div>
          )}
          <div className="my-2 space-y-1 border-l-2 pl-3">
            {data.personalTax.bracketBreakdown.map((b, i) => (
              <div key={i} className="flex justify-between text-muted-foreground">
                <span>
                  {fmt(b.from)} – {b.to === Infinity ? "+" : fmt(b.to)} @{" "}
                  {(b.rate * 100).toFixed(1)}%
                </span>
                <span>{fmt(b.tax)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between">
            <span>Gross Tax</span>
            <span>{fmt(data.personalTax.totalTax)}</span>
          </div>
          <div className="flex justify-between text-green-600">
            <span>Less: Tax Already Paid</span>
            <span>({fmt(data.totalTaxPaid)})</span>
          </div>
          <div className="flex items-center justify-between border-t pt-2 text-lg font-bold">
            <span>Tax to Pay</span>
            <div className="flex items-center gap-1">
              <span>{fmt(data.taxToPay)}</span>
              <CopyButton
                value={data.taxToPay.toLocaleString("en-NZ", {
                  minimumFractionDigits: 2,
                })}
              />
            </div>
          </div>
          <div className="text-muted-foreground">
            Effective rate: {(data.personalTax.effectiveRate * 100).toFixed(1)}%
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
