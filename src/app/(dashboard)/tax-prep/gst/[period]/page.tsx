"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { ChevronDown, ChevronRight, Check } from "lucide-react";
import { formatPeriod } from "@/lib/gst/periods";

type LineItem = {
  description: string;
  contactName: string;
  invoiceNumber: string;
  type: "sales" | "purchases";
  amount: number;
  gst: number;
};

type GstWorksheetData = {
  period: { from: string; to: string };
  basis: string;
  gstRate: number;
  totalSales: number;
  totalPurchases: number;
  gstOnSales: number;
  gstOnPurchases: number;
  netGst: number;
  lineItems: LineItem[];
  filingStatus: string;
  filedDate: string | null;
};

function BoxRow({
  box,
  label,
  value,
  bold,
  highlight,
  children,
}: {
  box: number;
  label: string;
  value: number;
  bold?: boolean;
  highlight?: "red" | "green";
  children?: React.ReactNode;
}) {
  const formatted = value.toLocaleString("en-NZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const colorClass =
    highlight === "red"
      ? "text-red-600"
      : highlight === "green"
        ? "text-green-600"
        : "";

  return (
    <div>
      <div
        className={`flex items-center justify-between py-2 ${bold ? "font-medium" : ""}`}
      >
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="w-10 justify-center text-xs">
            {box}
          </Badge>
          <span>{label}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className={colorClass}>${formatted}</span>
          <CopyButton value={formatted} />
        </div>
      </div>
      {children}
    </div>
  );
}

function ExpandableLineItems({
  items,
  type,
}: {
  items: LineItem[];
  type: "sales" | "purchases";
}) {
  const [expanded, setExpanded] = useState(false);
  const filtered = items.filter((i) => i.type === type);

  if (filtered.length === 0) return null;

  const fmt = (n: number) =>
    n.toLocaleString("en-NZ", { minimumFractionDigits: 2 });

  return (
    <div className="ml-14">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        {filtered.length} {type === "sales" ? "sale" : "purchase"}
        {filtered.length !== 1 ? "s" : ""}
      </button>
      {expanded && (
        <div className="mt-1 space-y-1 border-l pl-3 text-xs text-muted-foreground">
          {filtered.map((item, i) => (
            <div key={i} className="flex justify-between gap-4">
              <span className="truncate">
                {item.contactName} — {item.invoiceNumber}
              </span>
              <span className="shrink-0">
                ${fmt(item.amount)} + ${fmt(item.gst)} GST
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function GstWorksheetPage() {
  const params = useParams<{ period: string }>();
  const [data, setData] = useState<GstWorksheetData | null>(null);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    fetch(`/api/tax-prep/gst/${params.period}`)
      .then((r) => r.json())
      .then(setData);
  }, [params.period]);

  if (!data) return <div>Loading...</div>;

  const isFiled = data.filingStatus === "filed";

  async function markFiled() {
    setMarking(true);
    const [from, to] = params.period.split("_");
    await fetch("/api/filing-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filing_type: "gst",
        period_key: params.period,
        status: "filed",
        filed_date: new Date().toISOString().slice(0, 10),
        data_snapshot: {
          totalSales: data!.totalSales,
          totalPurchases: data!.totalPurchases,
          gstOnSales: data!.gstOnSales,
          gstOnPurchases: data!.gstOnPurchases,
          netGst: data!.netGst,
        },
      }),
    });
    setData({ ...data!, filingStatus: "filed", filedDate: new Date().toISOString().slice(0, 10) });
    setMarking(false);
  }

  // Calculate box values
  const box5 = data.totalSales;
  const box6 = 0; // zero-rated — Xero doesn't distinguish
  const box7 = box5 - box6;
  const box8 = data.gstOnSales;
  const box9 = 0; // adjustments increase
  const box10 = box8 + box9;
  const box11 = data.totalPurchases;
  const box12 = data.gstOnPurchases;
  const box13 = 0; // adjustments decrease
  const box14 = box12 + box13;
  const box15 = box10 - box14;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">GST101A — Return Worksheet</h1>
          <p className="text-muted-foreground">
            {formatPeriod(data.period.from, data.period.to)} — {data.basis} basis
          </p>
        </div>
        {isFiled && (
          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
            Filed {data.filedDate}
          </Badge>
        )}
      </div>

      {data.lineItems.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              No invoice data for this period. Sync from Xero to populate.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Sales and Income</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0 divide-y text-sm">
          <BoxRow box={5} label="Total sales and income (excluding GST)" value={box5}>
            <ExpandableLineItems items={data.lineItems} type="sales" />
          </BoxRow>
          <BoxRow box={6} label="Zero-rated supplies" value={box6} />
          <BoxRow box={7} label="Total sales subject to GST (Box 5 − Box 6)" value={box7} />
          <BoxRow box={8} label="GST collected on sales" value={box8} />
          <BoxRow box={9} label="Adjustments (increase)" value={box9} />
          <BoxRow box={10} label="Total GST collected (Box 8 + Box 9)" value={box10} bold />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Purchases and Expenses</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0 divide-y text-sm">
          <BoxRow box={11} label="Total purchases and expenses (excluding GST)" value={box11}>
            <ExpandableLineItems items={data.lineItems} type="purchases" />
          </BoxRow>
          <BoxRow box={12} label="GST on purchases" value={box12} />
          <BoxRow box={13} label="Adjustments (decrease)" value={box13} />
          <BoxRow box={14} label="Total GST credit (Box 12 + Box 13)" value={box14} bold />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>GST to Pay or Refund</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <BoxRow
            box={15}
            label={box15 >= 0 ? "GST to pay (Box 10 − Box 14)" : "GST refund (Box 14 − Box 10)"}
            value={Math.abs(box15)}
            bold
            highlight={box15 >= 0 ? "red" : "green"}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {box15 >= 0
              ? "This amount is payable to IRD."
              : "You are due a refund from IRD."}
          </p>
        </CardContent>
      </Card>

      {!isFiled && (
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
