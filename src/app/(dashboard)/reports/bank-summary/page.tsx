import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { decrypt } from "@/lib/encryption";
import { generateBalanceSheet } from "@/lib/ledger/reports/balance-sheet";
import { ReportHeader } from "@/components/reports/report-header";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNzd } from "@/lib/reports/parsers";
import { todayNZ } from "@/lib/utils/dates";

export default async function BankSummaryPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.activeBusiness) redirect("/settings?new=true");

  const biz = session.activeBusiness;
  const db = getDb();

  // Akahu-linked bank accounts for this business
  const akahuRows = db
    .select()
    .from(schema.akahuAccounts)
    .where(eq(schema.akahuAccounts.linked_business_id, biz.id))
    .all();

  const akahuAccounts = akahuRows.map((a) => ({
    id: a.id,
    name: decrypt(a.name),
    institution: decrypt(a.institution),
    account_type: a.account_type,
    balance: a.balance,
    available_balance: a.available_balance,
    last_synced_at: a.last_synced_at,
  }));

  // Cash at Bank balance from ledger (account code 1100)
  const today = todayNZ();
  const bsReport = generateBalanceSheet(biz.id, today);
  const cashAtBankAccount = bsReport.assets.accounts.find(
    (a) => a.code === "1100"
  );

  const hasAkahu = akahuAccounts.length > 0;
  const hasLedgerCash = cashAtBankAccount !== undefined;

  return (
    <>
      <ReportHeader title="Bank Summary" />

      <Card>
        <CardContent className="pt-6">
          {!hasAkahu && !hasLedgerCash ? (
            <p className="text-sm text-muted-foreground">
              No bank data available yet. Connect Akahu in Settings to sync live bank balances, or post journal entries to see ledger cash balances.
            </p>
          ) : (
            <div className="space-y-6">
              {/* Ledger Cash at Bank */}
              {hasLedgerCash && (
                <div>
                  <h3 className="text-sm font-semibold mb-3">Ledger Balance</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell>{cashAtBankAccount!.name}</TableCell>
                        <TableCell className="text-right font-medium">
                          ${formatNzd(cashAtBankAccount!.amount)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Akahu live bank accounts */}
              {hasAkahu && (
                <div>
                  <h3 className="text-sm font-semibold mb-3">Live Bank Balances (Akahu)</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account</TableHead>
                        <TableHead>Institution</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                        <TableHead className="text-right">Available</TableHead>
                        <TableHead>Last Synced</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {akahuAccounts.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium">{a.name}</TableCell>
                          <TableCell className="text-muted-foreground">{a.institution}</TableCell>
                          <TableCell className="text-muted-foreground capitalize">
                            {a.account_type.replace("_", " ")}
                          </TableCell>
                          <TableCell className="text-right">
                            ${formatNzd(a.balance)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {a.available_balance != null
                              ? `$${formatNzd(a.available_balance)}`
                              : "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {a.last_synced_at
                              ? a.last_synced_at.toLocaleDateString("en-NZ")
                              : "Never"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <p className="text-xs text-muted-foreground mt-3">
                    Live balances from Akahu. For statement accuracy, verify directly in your bank.
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
