import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  name: string;
  balance: number;
  isOverdrawn: boolean;
  ownershipPercentage: number;
};

export function BalanceCard({ name, balance, isOverdrawn, ownershipPercentage }: Props) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{name}</CardTitle>
        <span className="text-xs text-muted-foreground">
          {ownershipPercentage}% ownership
        </span>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <span
            className={`text-2xl font-bold ${
              isOverdrawn ? "text-red-600" : ""
            }`}
          >
            ${Math.abs(balance).toLocaleString("en-NZ", {
              minimumFractionDigits: 2,
            })}
          </span>
          {isOverdrawn ? (
            <Badge variant="destructive">Overdrawn</Badge>
          ) : balance < 0 ? (
            <Badge variant="secondary">Credit</Badge>
          ) : null}
        </div>
        {isOverdrawn && (
          <p className="mt-2 text-xs text-red-600">
            Overdrawn balance may trigger deemed dividend rules
          </p>
        )}
      </CardContent>
    </Card>
  );
}
