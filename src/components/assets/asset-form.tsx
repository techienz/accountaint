"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { ReceiptUpload } from "@/components/expenses/receipt-upload";

// Inline the categories and rates for client-side use
const CATEGORIES = [
  "Office Equipment", "Computers", "Software", "Telecommunications",
  "Motor Vehicles", "Building Fit-out", "Tools", "Machinery",
  "Kitchen", "Electrical",
];

const RATES: Record<string, { assetType: string; dvRate: number; slRate: number }[]> = {
  "Office Equipment": [
    { assetType: "Desk", dvRate: 0.20, slRate: 0.13 },
    { assetType: "Office chair", dvRate: 0.20, slRate: 0.13 },
    { assetType: "Filing cabinet", dvRate: 0.13, slRate: 0.085 },
  ],
  "Computers": [
    { assetType: "Desktop computer", dvRate: 0.50, slRate: 0.25 },
    { assetType: "Laptop", dvRate: 0.50, slRate: 0.25 },
    { assetType: "Tablet", dvRate: 0.50, slRate: 0.25 },
    { assetType: "Computer monitor", dvRate: 0.50, slRate: 0.25 },
    { assetType: "Printer", dvRate: 0.40, slRate: 0.20 },
    { assetType: "Server", dvRate: 0.50, slRate: 0.25 },
    { assetType: "Network equipment (router/switch)", dvRate: 0.40, slRate: 0.20 },
  ],
  "Software": [
    { assetType: "Purchased software", dvRate: 0.50, slRate: 0.25 },
  ],
  "Telecommunications": [
    { assetType: "Mobile phone", dvRate: 0.67, slRate: 0.335 },
    { assetType: "Telephone system", dvRate: 0.40, slRate: 0.20 },
  ],
  "Motor Vehicles": [
    { assetType: "Motor vehicle (car)", dvRate: 0.30, slRate: 0.21 },
    { assetType: "Motor vehicle (van/ute)", dvRate: 0.30, slRate: 0.21 },
    { assetType: "Motorcycle", dvRate: 0.30, slRate: 0.21 },
    { assetType: "Trailer", dvRate: 0.20, slRate: 0.13 },
  ],
  "Building Fit-out": [
    { assetType: "Carpet", dvRate: 0.25, slRate: 0.16 },
    { assetType: "Blinds/curtains", dvRate: 0.40, slRate: 0.20 },
    { assetType: "Partitions (non-structural)", dvRate: 0.20, slRate: 0.13 },
    { assetType: "Signage", dvRate: 0.40, slRate: 0.20 },
  ],
  "Tools": [
    { assetType: "Power tools", dvRate: 0.40, slRate: 0.20 },
    { assetType: "Hand tools", dvRate: 0.40, slRate: 0.20 },
  ],
  "Machinery": [
    { assetType: "General machinery", dvRate: 0.20, slRate: 0.13 },
    { assetType: "Forklift", dvRate: 0.30, slRate: 0.21 },
  ],
  "Kitchen": [
    { assetType: "Refrigerator (commercial)", dvRate: 0.25, slRate: 0.16 },
    { assetType: "Oven/stove (commercial)", dvRate: 0.25, slRate: 0.16 },
    { assetType: "Dishwasher (commercial)", dvRate: 0.40, slRate: 0.20 },
  ],
  "Electrical": [
    { assetType: "Air conditioning unit", dvRate: 0.20, slRate: 0.13 },
    { assetType: "Heater (electric)", dvRate: 0.25, slRate: 0.16 },
    { assetType: "Security system/cameras", dvRate: 0.30, slRate: 0.21 },
  ],
};

type Props = {
  onSubmit: (data: Record<string, unknown>, receiptFile?: File) => void;
  initialData?: {
    name?: string;
    category?: string;
    purchase_date?: string;
    cost?: string;
    notes?: string;
  };
};

export function AssetForm({ onSubmit, initialData }: Props) {
  const [name, setName] = useState(initialData?.name || "");
  const [category, setCategory] = useState(initialData?.category || "");
  const [assetType, setAssetType] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(
    initialData?.purchase_date || new Date().toISOString().split("T")[0]
  );
  const [cost, setCost] = useState(initialData?.cost || "");
  const [method, setMethod] = useState<"DV" | "SL">("DV");
  const [rate, setRate] = useState("");
  const [notes, setNotes] = useState(initialData?.notes || "");
  const [saving, setSaving] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);

  const assetTypes = category ? RATES[category] || [] : [];

  // Auto-fill rate when asset type changes
  useEffect(() => {
    if (assetType && category) {
      const found = assetTypes.find((a) => a.assetType === assetType);
      if (found) {
        setRate(String(method === "DV" ? found.dvRate : found.slRate));
        if (!name) setName(assetType);
      }
    }
  }, [assetType, method]);

  const isLowValue = Number(cost) > 0 && Number(cost) < 1000;

  function handleReceiptSelect(file: File) {
    setReceiptFile(file);
    if (file.type.startsWith("image/")) {
      setReceiptPreview(URL.createObjectURL(file));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSubmit({
      name,
      category,
      purchase_date: purchaseDate,
      cost: Number(cost),
      depreciation_method: method,
      depreciation_rate: Number(rate),
      notes: notes || null,
    }, receiptFile ?? undefined);
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => { if (v) { setCategory(v); setAssetType(""); } }}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Asset Type</Label>
              <Select value={assetType} onValueChange={(v) => v && setAssetType(v)} disabled={!category}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {assetTypes.map((a) => (
                    <SelectItem key={a.assetType} value={a.assetType}>{a.assetType}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. MacBook Pro 16-inch" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Purchase Date</Label>
              <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} required />
            </div>
            <div>
              <Label>Cost (ex GST) ($)</Label>
              <Input type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} required />
              {isLowValue && (
                <p className="mt-1 text-xs text-amber-600">
                  Below $1,000 — will be treated as low-value asset (fully expensed)
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Depreciation Method</Label>
              <Select value={method} onValueChange={(v) => v && setMethod(v as "DV" | "SL")}>
                <SelectTrigger><SelectValue labels={{ DV: "Diminishing Value (DV)", SL: "Straight Line (SL)" }} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DV">Diminishing Value (DV)</SelectItem>
                  <SelectItem value="SL">Straight Line (SL)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Depreciation Rate</Label>
              <Input type="number" step="0.001" value={rate} onChange={(e) => setRate(e.target.value)} required />
            </div>
          </div>

          <div>
            <Label>Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
          </div>

          <div className="space-y-2">
            <Label>Receipt / Proof of Purchase (optional)</Label>
            <ReceiptUpload onFileSelect={handleReceiptSelect} preview={receiptPreview} />
          </div>

          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Add Asset"}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
