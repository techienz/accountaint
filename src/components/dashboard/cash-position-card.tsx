import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
// Cash flow report link added to connected state

type BankAccount = {
  AccountID: string;
  Name: string;
  BankAccountNumber?: string;
  Type: string;
  Status: string;
};

type BankAccountsData = {
  Accounts?: BankAccount[];
};

export function CashPositionCard({
  data,
  connected,
}: {
  data: BankAccountsData | null;
  connected: boolean;
}) {
  if (!connected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Cash Position</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            <Link href="/settings/xero" className="text-primary hover:underline">
              Connect Xero
            </Link>{" "}
            to see your bank accounts.
          </p>
        </CardContent>
      </Card>
    );
  }

  const accounts = data?.Accounts?.filter((a) => a.Status === "ACTIVE") || [];

  if (accounts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Cash Position</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No bank accounts found. Try syncing from Xero.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Cash Position</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {accounts.map((account) => (
          <div key={account.AccountID} className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground truncate">
              {account.Name}
            </span>
          </div>
        ))}
        <div className="border-t pt-3">
          <Link
            href="/reports/cash-flow"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            View cash flow →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
