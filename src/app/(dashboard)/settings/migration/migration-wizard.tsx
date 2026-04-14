"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface MigrationWizardProps {
  hasCoa: boolean;
  accountCount: number;
  isXeroConnected: boolean;
  hasBalanceSheet: boolean;
  bsSyncedAt: string | null;
  hasExistingOpeningBalance: boolean;
}

type MigrationResultMapping = {
  xeroName: string;
  xeroAmount: number;
  localAccount: { id: string; code: string; name: string } | null;
  matched: boolean;
};

type MigrationResultData = {
  journalEntryId: string | null;
  mappings: MigrationResultMapping[];
  matchedCount: number;
  unmatchedCount: number;
  totalDebits: number;
  totalCredits: number;
  error?: string;
};

export function MigrationWizard({
  hasCoa,
  accountCount,
  isXeroConnected,
  hasBalanceSheet,
  bsSyncedAt,
  hasExistingOpeningBalance,
}: MigrationWizardProps) {
  const router = useRouter();
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<MigrationResultData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Default to start of current NZ tax year (April 1)
  const today = new Date();
  const year =
    today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  const defaultDate = `${year}-04-01`;
  const [asAtDate, setAsAtDate] = useState(defaultDate);

  async function handleImport() {
    setImporting(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/ledger/migration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asAtDate }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to import opening balances");
        return;
      }

      if (data.error) {
        setError(data.error);
        setResult(data);
        return;
      }

      setResult(data);
      router.refresh();
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Opening Balance Migration
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Import your opening balances from Xero to start tracking in the local
          ledger.
        </p>
      </div>

      {/* Step 1: COA Status */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Step 1: Chart of Accounts
            </CardTitle>
            {hasCoa ? (
              <Badge
                variant="secondary"
                className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
              >
                Ready
              </Badge>
            ) : (
              <Badge variant="outline">Not seeded</Badge>
            )}
          </div>
          <CardDescription>
            {hasCoa
              ? `${accountCount} accounts configured.`
              : "A default NZ Chart of Accounts will be created when you import."}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Step 2: Xero Connection */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Step 2: Xero Connection
            </CardTitle>
            {isXeroConnected ? (
              <Badge
                variant="secondary"
                className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
              >
                Connected
              </Badge>
            ) : (
              <Badge variant="destructive">Not connected</Badge>
            )}
          </div>
          <CardDescription>
            {isXeroConnected ? (
              hasBalanceSheet ? (
                <>
                  Balance sheet cached
                  {bsSyncedAt && (
                    <span className="text-muted-foreground">
                      {" "}
                      (synced{" "}
                      {new Date(bsSyncedAt).toLocaleDateString("en-NZ")})
                    </span>
                  )}
                </>
              ) : (
                "Xero is connected but no balance sheet has been synced yet. Sync from Xero Settings first."
              )
            ) : (
              <>
                Connect Xero from{" "}
                <a href="/settings/xero" className="underline">
                  Xero Settings
                </a>{" "}
                to import opening balances.
              </>
            )}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Step 3: Import */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Step 3: Import Opening Balances
          </CardTitle>
          <CardDescription>
            Creates a journal entry with your Xero balance sheet figures as of
            the selected date.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasExistingOpeningBalance && !result && (
            <div className="mb-4 rounded-md bg-yellow-50 dark:bg-yellow-950 p-3 text-sm text-yellow-800 dark:text-yellow-200">
              Opening balances have already been imported. Importing again will
              create a duplicate journal entry.
            </div>
          )}

          <div className="flex items-end gap-4">
            <div className="space-y-2">
              <label
                htmlFor="asAtDate"
                className="text-sm font-medium leading-none"
              >
                As at date
              </label>
              <Input
                id="asAtDate"
                type="date"
                value={asAtDate}
                onChange={(e) => setAsAtDate(e.target.value)}
                className="w-44"
              />
            </div>
            <Button
              onClick={handleImport}
              disabled={importing || !hasBalanceSheet}
            >
              {importing ? "Importing..." : "Import Opening Balances"}
            </Button>
          </div>

          {!hasBalanceSheet && isXeroConnected && (
            <p className="mt-2 text-sm text-muted-foreground">
              Sync Xero first to get the balance sheet data.
            </p>
          )}

          {error && (
            <div className="mt-4 rounded-md bg-red-50 dark:bg-red-950 p-3 text-sm text-red-800 dark:text-red-200">
              {error}
            </div>
          )}

          {result && result.journalEntryId && (
            <div className="mt-4 space-y-4">
              <div className="rounded-md bg-green-50 dark:bg-green-950 p-3 text-sm text-green-800 dark:text-green-200">
                Opening balances imported successfully.
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Matched accounts:</span>{" "}
                  {result.matchedCount}
                </div>
                <div>
                  <span className="font-medium">Unmatched accounts:</span>{" "}
                  {result.unmatchedCount}
                </div>
                <div>
                  <span className="font-medium">Total debits:</span> $
                  {result.totalDebits.toLocaleString("en-NZ", {
                    minimumFractionDigits: 2,
                  })}
                </div>
                <div>
                  <span className="font-medium">Total credits:</span> $
                  {result.totalCredits.toLocaleString("en-NZ", {
                    minimumFractionDigits: 2,
                  })}
                </div>
              </div>

              {/* Account mapping details */}
              <div>
                <h4 className="text-sm font-medium mb-2">Account Mappings</h4>
                <div className="max-h-64 overflow-y-auto rounded border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50 text-left">
                        <th className="px-3 py-2 font-medium">Xero Account</th>
                        <th className="px-3 py-2 font-medium text-right">
                          Amount
                        </th>
                        <th className="px-3 py-2 font-medium">
                          Local Account
                        </th>
                        <th className="px-3 py-2 font-medium text-center">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {result.mappings.map((m, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2">{m.xeroName}</td>
                          <td className="px-3 py-2 text-right">
                            $
                            {Math.abs(m.xeroAmount).toLocaleString("en-NZ", {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                          <td className="px-3 py-2">
                            {m.localAccount
                              ? `${m.localAccount.code} ${m.localAccount.name}`
                              : "-"}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {m.matched ? (
                              <Badge
                                variant="secondary"
                                className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                              >
                                Matched
                              </Badge>
                            ) : (
                              <Badge variant="destructive">Unmatched</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
                <a href="/reports/comparison" className="underline">
                  View comparison report
                </a>{" "}
                to verify alignment with Xero.
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
