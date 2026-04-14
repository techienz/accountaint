import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { generateTrialBalance } from "@/lib/ledger/reports/trial-balance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const fmt = (n: number) =>
  n === 0 ? "—" : "$" + Math.abs(n).toLocaleString("en-NZ", { minimumFractionDigits: 2 });

export default async function TrialBalancePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.activeBusiness) redirect("/settings");

  const report = generateTrialBalance(session.activeBusiness.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Trial Balance</h1>
          <p className="text-muted-foreground">
            Summary of all account balances from journal entries
          </p>
        </div>
        <Badge variant={report.isBalanced ? "default" : "destructive"}>
          {report.isBalanced ? "Balanced" : "Unbalanced"}
        </Badge>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.rows
                .filter((r) => r.debit !== 0 || r.credit !== 0)
                .map((row) => (
                  <TableRow key={row.account_id}>
                    <TableCell className="font-mono text-sm">{row.code}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell className="text-muted-foreground capitalize text-sm">
                      {row.type}
                    </TableCell>
                    <TableCell className="text-right">{fmt(row.debit)}</TableCell>
                    <TableCell className="text-right">{fmt(row.credit)}</TableCell>
                  </TableRow>
                ))}
              <TableRow className="font-semibold border-t-2">
                <TableCell colSpan={3}>Total</TableCell>
                <TableCell className="text-right">{fmt(report.totalDebit)}</TableCell>
                <TableCell className="text-right">{fmt(report.totalCredit)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
