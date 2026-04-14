import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

type BankAccountInfo = {
  name: string;
  balance: number;
  source: "akahu" | "xero" | "ledger";
};

export function CashPositionCard({ accounts }: { accounts: BankAccountInfo[] }) {
  const total = accounts.reduce((sum, a) => sum + a.balance, 0);

  if (accounts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Cash Position</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No bank accounts connected. <Link href="/settings/bank-feeds" className="text-primary hover:underline">Connect bank feeds</Link> to track your cash position.
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
        {accounts.map((account, i) => (
          <div key={i} className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground truncate">
              {account.name}
            </span>
            <span className="font-medium">
              ${account.balance.toLocaleString("en-NZ", { minimumFractionDigits: 2 })}
            </span>
          </div>
        ))}
        {accounts.length > 1 && (
          <div className="border-t pt-3 flex items-center justify-between">
            <span className="text-sm font-medium">Total</span>
            <span className="font-semibold">
              ${total.toLocaleString("en-NZ", { minimumFractionDigits: 2 })}
            </span>
          </div>
        )}
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
