"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { TransactionForm } from "@/components/shareholders/transaction-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, ArrowLeft } from "lucide-react";

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
  ownership_percentage: number;
  is_director: boolean;
};

export default function ShareholderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [shareholder, setShareholder] = useState<Shareholder | null>(null);
  const [balance, setBalance] = useState<BalanceData | null>(null);
  const taxYear = String(new Date().getFullYear());

  async function handleDelete() {
    if (!confirm("Delete this shareholder and all their transactions? This cannot be undone.")) return;
    const res = await fetch(`/api/shareholders/${params.id}`, { method: "DELETE" });
    if (res.ok) router.push("/shareholders");
  }

  const loadData = useCallback(async () => {
    const [shRes, txRes] = await Promise.all([
      fetch(`/api/shareholders/${params.id}`),
      fetch(`/api/shareholders/${params.id}/transactions?tax_year=${taxYear}`),
    ]);
    if (shRes.ok) setShareholder(await shRes.json());
    if (txRes.ok) setBalance(await txRes.json());
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
            {shareholder.is_director && " · Director"}
          </p>
        </div>
        <Button variant="destructive" onClick={handleDelete}>
          Delete Shareholder
        </Button>
      </div>

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
              {balance ? fmt(balance.closingBalance) : "—"}
            </span>
            {balance && balance.closingBalance < 0 && (
              <Badge variant="destructive" className="ml-2">
                Overdrawn
              </Badge>
            )}
          </CardContent>
        </Card>
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
                    <TableCell>{tx.description || "—"}</TableCell>
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
    </div>
  );
}
