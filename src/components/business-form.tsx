"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { IrdNumberInput } from "@/components/ird-number-input";
import { validateIrdNumber } from "@/lib/tax/ird-validator";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Business = {
  id?: string;
  name: string;
  entity_type: string;
  ird_number?: string | null;
  balance_date: string;
  gst_registered: boolean;
  gst_filing_period?: string | null;
  gst_basis?: string | null;
  provisional_tax_method?: string | null;
  has_employees: boolean;
  paye_frequency?: string | null;
  nzbn?: string | null;
  company_number?: string | null;
  registered_office?: string | null;
  invoice_prefix?: string | null;
  payment_instructions?: string | null;
  invoice_custom_footer?: string | null;
  invoice_show_branding?: boolean;
  invoice_logo_path?: string | null;
};

type BusinessFormProps = {
  business?: Business;
  onSaved?: () => void;
};

export function BusinessForm({ business, onSaved }: BusinessFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const isEditing = !!business?.id;

  const [entityType, setEntityType] = useState(business?.entity_type || "company");
  const [gstRegistered, setGstRegistered] = useState(business?.gst_registered ?? false);
  const [hasEmployees, setHasEmployees] = useState(business?.has_employees ?? false);
  const [irdNumber, setIrdNumber] = useState(business?.ird_number || "");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (irdNumber) {
      const irdResult = validateIrdNumber(irdNumber);
      if (!irdResult.valid) {
        setError(irdResult.error || "Invalid IRD number");
        setLoading(false);
        return;
      }
    }

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      entity_type: entityType,
      ird_number: irdNumber || undefined,
      nzbn: entityType === "company" ? (formData.get("nzbn") as string) || undefined : undefined,
      company_number: entityType === "company" ? (formData.get("company_number") as string) || undefined : undefined,
      registered_office: entityType === "company" ? (formData.get("registered_office") as string) || undefined : undefined,
      balance_date: formData.get("balance_date") as string,
      gst_registered: gstRegistered,
      gst_filing_period: gstRegistered
        ? (formData.get("gst_filing_period") as string)
        : undefined,
      gst_basis: gstRegistered
        ? (formData.get("gst_basis") as string)
        : undefined,
      provisional_tax_method:
        (formData.get("provisional_tax_method") as string) || undefined,
      has_employees: hasEmployees,
      paye_frequency: hasEmployees
        ? (formData.get("paye_frequency") as string)
        : undefined,
      ...(isEditing ? {
        invoice_prefix: (formData.get("invoice_prefix") as string) || "INV",
        payment_instructions: (formData.get("payment_instructions") as string) || undefined,
        invoice_custom_footer: (formData.get("invoice_custom_footer") as string) || undefined,
        invoice_show_branding: formData.get("invoice_show_branding") === "on",
      } : {}),
    };

    const url = isEditing
      ? `/api/businesses/${business.id}`
      : "/api/businesses";
    const method = isEditing ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const result = await res.json();
    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      if (onSaved) onSaved();
      router.refresh();
      if (!isEditing) router.push("/");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? "Edit Business" : "Add Business"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic info */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Business name</Label>
              <Input
                id="name"
                name="name"
                defaultValue={business?.name}
                required
                autoFocus={!isEditing}
              />
            </div>

            <div className="space-y-2">
              <Label>Entity type</Label>
              <Select value={entityType} onValueChange={(v) => v && setEntityType(v)}>
                <SelectTrigger>
                  <SelectValue labels={{ company: "Company", sole_trader: "Sole Trader", partnership: "Partnership", trust: "Trust" }} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="company">Company</SelectItem>
                  <SelectItem value="sole_trader">Sole Trader</SelectItem>
                  <SelectItem value="partnership">Partnership</SelectItem>
                  <SelectItem value="trust">Trust</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {entityType === "company" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="nzbn">NZBN</Label>
                  <Input
                    id="nzbn"
                    name="nzbn"
                    defaultValue={business?.nzbn || ""}
                    placeholder="e.g. 9429000000000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company_number">Company number</Label>
                  <Input
                    id="company_number"
                    name="company_number"
                    defaultValue={business?.company_number || ""}
                    placeholder="e.g. 1234567"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="registered_office">Registered office</Label>
                  <Input
                    id="registered_office"
                    name="registered_office"
                    defaultValue={business?.registered_office || ""}
                    placeholder="e.g. 123 Queen St, Auckland"
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="ird_number">IRD number</Label>
              <IrdNumberInput
                id="ird_number"
                value={irdNumber}
                onChange={setIrdNumber}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="balance_date">Balance date</Label>
              <Select
                name="balance_date"
                defaultValue={business?.balance_date || "03-31"}
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

          {/* GST */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="gst_registered"
                checked={gstRegistered}
                onChange={(e) => setGstRegistered(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="gst_registered">GST registered</Label>
            </div>

            {gstRegistered && (
              <>
                <div className="space-y-2">
                  <Label>GST filing period</Label>
                  <Select
                    name="gst_filing_period"
                    defaultValue={business?.gst_filing_period || "2monthly"}
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
                </div>
                <div className="space-y-2">
                  <Label>GST basis</Label>
                  <Select
                    name="gst_basis"
                    defaultValue={business?.gst_basis || "invoice"}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="invoice">Invoice</SelectItem>
                      <SelectItem value="payments">Payments</SelectItem>
                      <SelectItem value="hybrid">Hybrid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>

          {/* Provisional tax */}
          <div className="space-y-2">
            <Label>Provisional tax method</Label>
            <Select
              name="provisional_tax_method"
              defaultValue={business?.provisional_tax_method || "standard"}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="estimation">Estimation</SelectItem>
                <SelectItem value="aim">AIM</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* PAYE */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="has_employees"
                checked={hasEmployees}
                onChange={(e) => setHasEmployees(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="has_employees">Has employees</Label>
            </div>

            {hasEmployees && (
              <div className="space-y-2">
                <Label>PAYE frequency</Label>
                <Select
                  name="paye_frequency"
                  defaultValue={business?.paye_frequency || "monthly"}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="twice_monthly">Twice monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Invoice Settings */}
          {isEditing && (
            <>
              <div className="border-t pt-6 mt-6">
                <h3 className="text-base font-semibold mb-4">Invoice Settings</h3>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="invoice_prefix">Invoice Prefix</Label>
                  <Input
                    id="invoice_prefix"
                    name="invoice_prefix"
                    defaultValue={business?.invoice_prefix || "INV"}
                    placeholder="INV"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invoice_logo">Logo</Label>
                  <Input
                    id="invoice_logo"
                    name="invoice_logo"
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const fd = new FormData();
                      fd.append("file", file);
                      await fetch("/api/settings/invoice-logo", { method: "POST", body: fd });
                    }}
                  />
                  {business?.invoice_logo_path && (
                    <p className="text-xs text-muted-foreground">Current: {business.invoice_logo_path}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment_instructions">Default Payment Instructions</Label>
                <Textarea
                  id="payment_instructions"
                  name="payment_instructions"
                  rows={2}
                  defaultValue={business?.payment_instructions || ""}
                  placeholder="e.g. Bank: 12-3456-7890123-00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoice_custom_footer">Custom Invoice Footer</Label>
                <Input
                  id="invoice_custom_footer"
                  name="invoice_custom_footer"
                  defaultValue={business?.invoice_custom_footer || ""}
                  placeholder="e.g. Thank you for your business"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="invoice_show_branding"
                  name="invoice_show_branding"
                  defaultChecked={business?.invoice_show_branding ?? true}
                />
                <Label htmlFor="invoice_show_branding" className="font-normal">
                  Show &quot;Generated by Accountaint&quot; on invoices
                </Label>
              </div>
            </>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" disabled={loading}>
            {loading
              ? "Saving..."
              : isEditing
                ? "Save Changes"
                : "Add Business"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
