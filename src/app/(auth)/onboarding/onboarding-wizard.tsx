"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IrdNumberInput } from "@/components/ird-number-input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type FormData = {
  name: string;
  entity_type: "company" | "sole_trader" | "partnership" | "trust";
  nzbn: string;
  company_number: string;
  registered_office: string;
  ird_number: string;
  balance_date: string;
  gst_registered: boolean;
  gst_filing_period: string;
  gst_basis: string;
  provisional_tax_method: string;
  has_employees: boolean;
  paye_frequency: string;
};

const STEP_TITLES = [
  "Entity type",
  "Company details",
  "Business name & IRD",
  "Balance date",
  "GST registration",
  "Provisional tax",
  "Employees",
  "Connect Xero",
  "Summary",
];

export function OnboardingWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialStep = searchParams.get("step") ? parseInt(searchParams.get("step")!) : 1;
  const xeroConnected = searchParams.get("connected") === "true";

  const [step, setStep] = useState(initialStep);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [businessId, setBusinessId] = useState<string | null>(null);

  const [form, setForm] = useState<FormData>({
    name: "",
    entity_type: "company",
    nzbn: "",
    company_number: "",
    registered_office: "",
    ird_number: "",
    balance_date: "03-31",
    gst_registered: false,
    gst_filing_period: "2monthly",
    gst_basis: "invoice",
    provisional_tax_method: "standard",
    has_employees: false,
    paye_frequency: "monthly",
  });

  function update(fields: Partial<FormData>) {
    setForm((prev) => ({ ...prev, ...fields }));
  }

  function next() {
    // Skip company details step for non-companies
    if (step === 1 && form.entity_type !== "company") {
      setStep(3);
    } else {
      setStep((s) => s + 1);
    }
  }

  function back() {
    if (step === 3 && form.entity_type !== "company") {
      setStep(1);
    } else {
      setStep((s) => Math.max(1, s - 1));
    }
  }

  async function saveBusiness(): Promise<string | null> {
    if (businessId) return businessId;

    setLoading(true);
    setError("");

    const body = {
      name: form.name,
      entity_type: form.entity_type,
      ird_number: form.ird_number || undefined,
      balance_date: form.balance_date,
      gst_registered: form.gst_registered,
      gst_filing_period: form.gst_registered ? form.gst_filing_period : undefined,
      gst_basis: form.gst_registered ? form.gst_basis : undefined,
      provisional_tax_method: form.provisional_tax_method || undefined,
      has_employees: form.has_employees,
      paye_frequency: form.has_employees ? form.paye_frequency : undefined,
      nzbn: form.entity_type === "company" ? form.nzbn || undefined : undefined,
      company_number: form.entity_type === "company" ? form.company_number || undefined : undefined,
      registered_office: form.entity_type === "company" ? form.registered_office || undefined : undefined,
    };

    const res = await fetch("/api/businesses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    setLoading(false);

    if (data.error) {
      setError(data.error);
      return null;
    }

    setBusinessId(data.business.id);
    return data.business.id;
  }

  async function handleConnectXero() {
    const id = await saveBusiness();
    if (!id) return;

    // Redirect to Xero connect with return to onboarding
    const res = await fetch(`/api/xero/connect?from=onboarding`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      setError("Failed to start Xero connection");
    }
  }

  async function handleFinish() {
    if (!businessId) {
      const id = await saveBusiness();
      if (!id) return;
    }
    router.push("/");
    router.refresh();
  }

  const totalSteps = form.entity_type === "company" ? 9 : 8;
  const displayStep = form.entity_type !== "company" && step >= 3 ? step - 1 : step;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set up your business</CardTitle>
        <CardDescription>
          Step {displayStep > totalSteps ? totalSteps : displayStep} of {totalSteps} — {STEP_TITLES[step - 1]}
        </CardDescription>
        <div className="w-full bg-muted rounded-full h-2 mt-2">
          <div
            className="bg-primary h-2 rounded-full transition-all"
            style={{ width: `${(Math.min(displayStep, totalSteps) / totalSteps) * 100}%` }}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-destructive">{error}</p>}

        {/* Step 1: Entity Type */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/50 border p-3 text-sm text-muted-foreground">
              Your entity type determines how you&apos;re taxed and what compliance obligations you have.
              If you&apos;re not sure, check your incorporation documents or ask your accountant.
            </div>
            <div className="space-y-2">
              <Label>What type of business entity?</Label>
              <Select
                value={form.entity_type}
                onValueChange={(v) => v && update({ entity_type: v as FormData["entity_type"] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="company">Company (Ltd)</SelectItem>
                  <SelectItem value="sole_trader">Sole Trader</SelectItem>
                  <SelectItem value="partnership">Partnership</SelectItem>
                  <SelectItem value="trust">Trust</SelectItem>
                </SelectContent>
              </Select>
              <div className="text-xs text-muted-foreground mt-2">
                {form.entity_type === "company" && (
                  <p><strong>Company (Ltd)</strong> — A separate legal entity registered with the Companies Office. Has its own IRD number, files IR4 returns, and pays tax at the company rate (28%).</p>
                )}
                {form.entity_type === "sole_trader" && (
                  <p><strong>Sole Trader</strong> — You and the business are the same legal entity. Income is reported on your personal IR3 return and taxed at personal rates.</p>
                )}
                {form.entity_type === "partnership" && (
                  <p><strong>Partnership</strong> — Two or more people carrying on business together. The partnership files an IR7, and each partner reports their share on their personal return.</p>
                )}
                {form.entity_type === "trust" && (
                  <p><strong>Trust</strong> — A legal arrangement where a trustee holds assets for beneficiaries. Files an IR6 return. Trustee income is taxed at 39%.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Company Details (only for companies) */}
        {step === 2 && form.entity_type === "company" && (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/50 border p-3 text-sm text-muted-foreground">
              These details help us identify your company. You can find your NZBN and company number
              on the <span className="font-medium">Companies Office website</span> (companies.govt.nz).
              All fields are optional — you can add them later.
            </div>
            <div className="space-y-2">
              <Label htmlFor="nzbn">NZBN</Label>
              <Input
                id="nzbn"
                value={form.nzbn}
                onChange={(e) => update({ nzbn: e.target.value })}
                placeholder="e.g. 9429000000000"
              />
              <p className="text-xs text-muted-foreground">
                Your 13-digit New Zealand Business Number. Find it at nzbn.govt.nz
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="company_number">Company number</Label>
              <Input
                id="company_number"
                value={form.company_number}
                onChange={(e) => update({ company_number: e.target.value })}
                placeholder="e.g. 1234567"
              />
              <p className="text-xs text-muted-foreground">
                Your Companies Office registration number
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="registered_office">Registered office</Label>
              <Input
                id="registered_office"
                value={form.registered_office}
                onChange={(e) => update({ registered_office: e.target.value })}
                placeholder="e.g. 123 Queen St, Auckland"
              />
              <p className="text-xs text-muted-foreground">
                The official address on your company registration
              </p>
            </div>
          </div>
        )}

        {/* Step 3: Name & IRD */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/50 border p-3 text-sm text-muted-foreground">
              Enter your business name as it appears on official documents.
              Your IRD number is used for all tax filings — you&apos;ll find it on any letter from Inland Revenue.
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Business name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => update({ name: e.target.value })}
                placeholder={form.entity_type === "company" ? "e.g. Acme Ltd" : "e.g. Smith Consulting"}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ird_number">IRD number</Label>
              <IrdNumberInput
                id="ird_number"
                value={form.ird_number}
                onChange={(value) => update({ ird_number: value })}
              />
              <p className="text-xs text-muted-foreground">
                {form.entity_type === "company"
                  ? "Your company's IRD number (different from your personal one). Optional — you can add it later."
                  : "Your business IRD number. Optional — you can add it later."}
              </p>
            </div>
          </div>
        )}

        {/* Step 4: Balance Date */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/50 border p-3 text-sm text-muted-foreground">
              Your balance date is when your financial year ends. This determines when your annual tax return is due.
              Most NZ businesses use <strong>31 March</strong> — if you haven&apos;t applied for a different date with IRD, this is almost certainly yours.
            </div>
            <div className="space-y-2">
              <Label>Balance date (financial year end)</Label>
              <Select
                value={form.balance_date}
                onValueChange={(v) => v && update({ balance_date: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="03-31">31 March (standard)</SelectItem>
                  <SelectItem value="06-30">30 June</SelectItem>
                  <SelectItem value="09-30">30 September</SelectItem>
                  <SelectItem value="12-31">31 December</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Step 5: GST */}
        {step === 5 && (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/50 border p-3 text-sm text-muted-foreground">
              You must register for GST if your turnover is (or is expected to be) over $60,000 in any 12-month period.
              If you&apos;re registered, you charge 15% GST on your sales and can claim back GST on business purchases.
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="gst_registered"
                checked={form.gst_registered}
                onChange={(e) => update({ gst_registered: e.target.checked })}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="gst_registered">My business is GST registered</Label>
            </div>

            {form.gst_registered && (
              <>
                <div className="space-y-2">
                  <Label>Filing period</Label>
                  <Select
                    value={form.gst_filing_period}
                    onValueChange={(v) => v && update({ gst_filing_period: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="2monthly">2-monthly</SelectItem>
                      <SelectItem value="6monthly">6-monthly</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Most small businesses file 2-monthly. Monthly is required if turnover exceeds $24M.
                    6-monthly is available if turnover is under $500,000.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Accounting basis</Label>
                  <Select
                    value={form.gst_basis}
                    onValueChange={(v) => v && update({ gst_basis: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="invoice">Invoice basis</SelectItem>
                      <SelectItem value="payments">Payments basis</SelectItem>
                      <SelectItem value="hybrid">Hybrid basis</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    <strong>Invoice basis</strong> — you account for GST when you invoice (most common).{" "}
                    <strong>Payments basis</strong> — you account for GST when you get paid (available if turnover is under $2M).{" "}
                    <strong>Hybrid</strong> — invoice basis for sales, payments basis for purchases.
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 6: Provisional Tax */}
        {step === 6 && (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/50 border p-3 text-sm text-muted-foreground">
              Provisional tax is how you pay income tax during the year, rather than in one lump sum after year-end.
              You&apos;ll need to pay provisional tax if your residual income tax was over $5,000 last year.
            </div>
            <div className="space-y-2">
              <Label>Provisional tax method</Label>
              <Select
                value={form.provisional_tax_method}
                onValueChange={(v) => v && update({ provisional_tax_method: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="estimation">Estimation</SelectItem>
                  <SelectItem value="aim">AIM (Accounting Income Method)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                <strong>Standard</strong> — IRD calculates your payments based on last year&apos;s tax (plus 5%). Simplest option.{" "}
                <strong>Estimation</strong> — you estimate your own tax for the year. Useful if income is changing significantly.{" "}
                <strong>AIM</strong> — pay based on actual income each period using approved software. Best for variable income.
              </p>
            </div>
          </div>
        )}

        {/* Step 7: Employees */}
        {step === 7 && (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/50 border p-3 text-sm text-muted-foreground">
              If you employ staff, you&apos;ll need to deduct PAYE (Pay As You Earn) from their wages
              and pay it to IRD. This includes income tax, ACC levies, KiwiSaver, and student loan deductions.
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="has_employees"
                checked={form.has_employees}
                onChange={(e) => update({ has_employees: e.target.checked })}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="has_employees">My business has employees</Label>
            </div>
            <p className="text-xs text-muted-foreground">
              This includes any staff on your payroll. Contractors and freelancers don&apos;t count — they handle their own tax.
            </p>

            {form.has_employees && (
              <div className="space-y-2">
                <Label>PAYE filing frequency</Label>
                <Select
                  value={form.paye_frequency}
                  onValueChange={(v) => v && update({ paye_frequency: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly (payday filing)</SelectItem>
                    <SelectItem value="twice_monthly">Twice monthly</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Since April 2019, all employers must file PAYE information within 2 working days of each payday (payday filing).
                  Most small employers file monthly.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step 8: Connect Xero */}
        {step === 8 && (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/50 border p-3 text-sm text-muted-foreground">
              Connecting Xero lets Accountaint automatically pull in your invoices, bank transactions, profit & loss, and balance sheet data.
              This is how we generate reports, track deadlines, and give you AI-powered insights about your business.
            </div>
            <p className="text-sm">
              You&apos;ll be redirected to Xero to authorise access. We only request <strong>read-only</strong> access — Accountaint never modifies your Xero data.
            </p>
            <div className="flex gap-3">
              <Button onClick={handleConnectXero} disabled={loading || !form.name}>
                {loading ? "Saving..." : "Connect Xero"}
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  await saveBusiness();
                  setStep(9);
                }}
                disabled={loading || !form.name}
              >
                Skip for now
              </Button>
            </div>
            {!form.name && (
              <p className="text-xs text-amber-600">Please go back and enter a business name first.</p>
            )}
            <p className="text-xs text-muted-foreground">
              You can always connect Xero later from Settings &gt; Xero.
            </p>
          </div>
        )}

        {/* Step 9: Summary */}
        {step === 9 && (
          <div className="space-y-4">
            {xeroConnected && (
              <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800">
                Xero connected successfully! Your data will start syncing automatically.
              </div>
            )}
            <div className="rounded-lg bg-muted/50 border p-3 text-sm text-muted-foreground">
              Here&apos;s a summary of your business setup. You can change any of these settings later from the Settings page.
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Business name</span>
                <span className="font-medium">{form.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Entity type</span>
                <span className="font-medium capitalize">{form.entity_type.replace("_", " ")}</span>
              </div>
              {form.ird_number && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">IRD number</span>
                  <span className="font-medium">{form.ird_number}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Balance date</span>
                <span className="font-medium">
                  {form.balance_date === "03-31" ? "31 March" :
                   form.balance_date === "06-30" ? "30 June" :
                   form.balance_date === "09-30" ? "30 September" : "31 December"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">GST registered</span>
                <span className="font-medium">{form.gst_registered ? "Yes" : "No"}</span>
              </div>
              {form.gst_registered && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">GST period</span>
                    <span className="font-medium">
                      {form.gst_filing_period === "monthly" ? "Monthly" :
                       form.gst_filing_period === "2monthly" ? "2-monthly" : "6-monthly"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">GST basis</span>
                    <span className="font-medium capitalize">{form.gst_basis}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Provisional tax</span>
                <span className="font-medium capitalize">{form.provisional_tax_method}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Employees</span>
                <span className="font-medium">{form.has_employees ? "Yes" : "No"}</span>
              </div>
            </div>
            <Button onClick={handleFinish} disabled={loading} className="w-full">
              {loading ? "Finishing..." : "Go to Dashboard"}
            </Button>
          </div>
        )}

        {/* Navigation */}
        {step < 8 && (
          <div className="flex justify-between pt-4">
            <Button
              variant="outline"
              onClick={back}
              disabled={step === 1}
            >
              Back
            </Button>
            <Button
              onClick={next}
              disabled={step === 3 && !form.name}
            >
              Next
            </Button>
          </div>
        )}
        {step === 8 && (
          <div className="flex justify-start pt-4">
            <Button variant="outline" onClick={back}>
              Back
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
