"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { TransactionForm } from "@/components/shareholders/transaction-form";
import { DeclareDividendDialog } from "@/components/shareholders/declare-dividend-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, ArrowLeft, Pencil } from "lucide-react";

type Transaction = {
  id: string;
  date: string;
  type: string;
  description: string | null;
  amount: number;
  runningBalance: number;
};

type BalanceData = {
  transactions: Transaction[];
  closingBalance: number;
  isOverdrawn: boolean;
  minBalance: number;
};

type Shareholder = {
  id: string;
  name: string;
  ird_number: string | null;
  date_of_birth: string | null;
  address: string | null;
  ownership_percentage: number;
  is_director: boolean;
};

export default function ShareholderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [shareholder, setShareholder] = useState<Shareholder | null>(null);
  const [balance, setBalance] = useState<BalanceData | null>(null);
  const [editing, setEditing] = useState(false);
  const taxYear = String(new Date().getFullYear());

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editIrd, setEditIrd] = useState("");
  const [editDob, setEditDob] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editOwnership, setEditOwnership] = useState("");
  const [editDirector, setEditDirector] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  function startEditing() {
    if (!shareholder) return;
    setEditName(shareholder.name);
    setEditIrd(shareholder.ird_number ?? "");
    setEditDob(shareholder.date_of_birth ?? "");
    setEditAddress(shareholder.address ?? "");
    setEditOwnership(String(shareholder.ownership_percentage));
    setEditDirector(shareholder.is_director);
    setEditError(null);
    setEditing(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setEditError(null);

    const res = await fetch(`/api/shareholders/${params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName,
        ird_number: editIrd || null,
        date_of_birth: editDob || null,
        address: editAddress || null,
        ownership_percentage: Number(editOwnership),
        is_director: editDirector,
      }),
    });

    if (res.ok) {
      setEditing(false);
      loadData();
    } else {
      const data = await res.json();
      setEditError(data.error || "Failed to update");
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirm("Delete this shareholder and all their transactions? This cannot be undone.")) return;
    const res = await fetch(`/api/shareholders/${params.id}`, { method: "DELETE" });
    if (res.ok) router.push("/shareholders");
  }

  const [prescribedInterest, setPrescribedInterest] = useState<{
    totalInterest: number;
    daysOverdrawn: number;
    prescribedRate: number;
    hasBeenCharged: boolean;
  } | null>(null);

  const loadData = useCallback(async () => {
    const [shRes, txRes, piRes] = await Promise.all([
      fetch(`/api/shareholders/${params.id}`),
      fetch(`/api/shareholders/${params.id}/transactions?tax_year=${taxYear}`),
      fetch(`/api/shareholders/${params.id}/prescribed-interest?tax_year=${taxYear}`),
    ]);
    if (shRes.ok) setShareholder(await shRes.json());
    if (txRes.ok) setBalance(await txRes.json());
    if (piRes.ok) setPrescribedInterest(await piRes.json());
  }, [params.id, taxYear]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!shareholder) return <div>Loading...</div>;

  const fmt = (n: number) =>
    "$" + Math.abs(n).toLocaleString("en-NZ", { minimumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <Link href="/shareholders" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to shareholders
      </Link>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{shareholder.name}</h1>
          <p className="text-muted-foreground">
            {shareholder.ownership_percentage}% ownership
            {shareholder.is_director && " \u00b7 Director"}
            {shareholder.ird_number && ` \u00b7 IRD ${shareholder.ird_number}`}
            {shareholder.date_of_birth && ` \u00b7 DOB ${shareholder.date_of_birth}`}
          </p>
          {shareholder.address && (
            <p className="text-sm text-muted-foreground">{shareholder.address}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={editing ? () => setEditing(false) : startEditing}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            {editing ? "Cancel" : "Edit"}
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </div>

      {editing && (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="sh-name">Name</Label>
                  <Input id="sh-name" value={editName} onChange={(e) => setEditName(e.target.value)} required />
                </div>
                <div>
                  <Label htmlFor="sh-ird">IRD Number</Label>
                  <Input id="sh-ird" value={editIrd} onChange={(e) => setEditIrd(e.target.value)} placeholder="e.g. 12-345-678" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="sh-dob">Date of Birth</Label>
                  <Input id="sh-dob" type="date" value={editDob} onChange={(e) => setEditDob(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="sh-ownership">Ownership (%)</Label>
                  <Input id="sh-ownership" type="number" min="0" max="100" step="0.1" value={editOwnership} onChange={(e) => setEditOwnership(e.target.value)} required />
                </div>
              </div>
              <div>
                <Label htmlFor="sh-address">Residential Address</Label>
                <Input id="sh-address" value={editAddress} onChange={(e) => setEditAddress(e.target.value)} placeholder="Optional" />
              </div>
              <div className="flex items-center gap-3">
                <Switch id="sh-director" checked={editDirector} onCheckedChange={setEditDirector} />
                <Label htmlFor="sh-director">Director</Label>
              </div>
              {editError && <p className="text-sm text-red-600">{editError}</p>}
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Update Shareholder"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {balance && balance.isOverdrawn && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Deemed Dividend Warning</AlertTitle>
          <AlertDescription>
            The current account is overdrawn by {fmt(balance.closingBalance)}.
            This may trigger deemed dividend rules under section CD 4 of the
            Income Tax Act 2007. Consider making repayments or declaring
            salary/dividends.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Current Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span
              className={`text-2xl font-bold ${
                balance && balance.closingBalance < 0 ? "text-red-600" : ""
              }`}
            >
              {balance ? fmt(balance.closingBalance) : "\u2014"}
            </span>
            {balance && balance.closingBalance < 0 && (
              <Badge variant="destructive" className="ml-2">
                Overdrawn
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-4">
        <DeclareDividendDialog onSuccess={loadData} />
      </div>

      <TransactionForm
        shareholderId={params.id}
        taxYear={taxYear}
        onSuccess={loadData}
      />

      {balance && balance.transactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {balance.transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>{tx.date}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {tx.type}
                      </Badge>
                    </TableCell>
                    <TableCell>{tx.description || "\u2014"}</TableCell>
                    <TableCell
                      className={`text-right ${
                        tx.amount > 0 ? "text-red-600" : "text-green-600"
                      }`}
                    >
                      {tx.amount > 0 ? "-" : "+"}
                      {fmt(tx.amount)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium ${
                        tx.runningBalance < 0 ? "text-red-600" : ""
                      }`}
                    >
                      {fmt(tx.runningBalance)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {prescribedInterest && prescribedInterest.totalInterest > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Prescribed Interest</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>
                Interest at {(prescribedInterest.prescribedRate * 100).toFixed(2)}% for{" "}
                {prescribedInterest.daysOverdrawn} days overdrawn
              </span>
              <span className="font-medium">{fmt(prescribedInterest.totalInterest)}</span>
            </div>
            {prescribedInterest.hasBeenCharged ? (
              <p className="text-sm text-green-600">
                Interest has been charged for this tax year.
              </p>
            ) : (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950">
                This interest should be charged to avoid the shortfall being treated as a deemed dividend.
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
