"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2 } from "lucide-react";

const fmt = (n: number) =>
  "$" + n.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type DebtPayoff = {
  monthsRemaining: number;
  estimatedPayoffDate: string | null;
  totalInterest: number;
};

export function DebtPayoffCard({
  name,
  balance,
  monthlyRepayment,
  interestRate,
  payoff,
  isMortgage,
  isCreditCard,
  creditLimit,
  startDate,
  endDate,
  lvr,
  onEdit,
  onDelete,
}: {
  name: string;
  balance: number;
  monthlyRepayment: number;
  interestRate: number;
  payoff: DebtPayoff;
  isMortgage?: boolean;
  isCreditCard?: boolean;
  creditLimit?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  lvr?: { lvr: number; equity: number; availableEquity: number } | null;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{name}</CardTitle>
        <div className="flex items-center gap-2">
          {isMortgage && <Badge variant="outline">Mortgage</Badge>}
          {isCreditCard && <Badge variant="outline">Credit Card</Badge>}
          {onEdit && (
            <button onClick={onEdit} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-accent">
              <Pencil className="h-3 w-3" /> Edit
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded-md hover:bg-destructive/10">
              <Trash2 className="h-3 w-3" /> Delete
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Balance</span>
          <span className="font-medium">{fmt(balance)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Monthly repayment</span>
          <span className="font-medium">{fmt(monthlyRepayment)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Interest rate</span>
          <span className="font-medium">{(interestRate * 100).toFixed(2)}%</span>
        </div>

        {startDate && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Started</span>
            <span className="font-medium">{startDate}</span>
          </div>
        )}

        {isCreditCard && creditLimit != null && creditLimit > 0 && (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Credit limit</span>
              <span className="font-medium">{fmt(creditLimit)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Available</span>
              <span className="font-medium text-green-600">{fmt(Math.max(0, creditLimit - balance))}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Utilisation</span>
              <span className={`font-medium ${balance / creditLimit > 0.8 ? "text-red-600" : ""}`}>
                {((balance / creditLimit) * 100).toFixed(0)}%
              </span>
            </div>
          </>
        )}

        {payoff.monthsRemaining !== Infinity && payoff.estimatedPayoffDate && (() => {
          const targetUnrealistic = endDate && payoff.estimatedPayoffDate > endDate;
          const targetMonths = endDate
            ? Math.max(0, Math.round((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30.44)))
            : null;
          const requiredPayment = endDate && targetMonths && targetMonths > 0
            ? Math.round((balance * (1 + interestRate * targetMonths / 12 / 2)) / targetMonths * 100) / 100
            : null;

          return (
            <>
              <div className="border-t pt-3 space-y-2">
                {endDate && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Target payoff</span>
                    <span className={`font-medium ${targetUnrealistic ? "text-red-600" : "text-green-600"}`}>
                      {endDate}
                      {targetMonths != null && <span className="text-xs ml-1">({targetMonths}mo)</span>}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Estimated payoff</span>
                  <span className="font-medium">{payoff.estimatedPayoffDate} <span className="text-xs">({payoff.monthsRemaining}mo)</span></span>
                </div>
                {targetUnrealistic && requiredPayment && (
                  <p className="text-xs text-red-600">
                    Need ~{fmt(requiredPayment)}/mo to hit target
                  </p>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total interest</span>
                  <span className="font-medium text-amber-600">{fmt(payoff.totalInterest)}</span>
                </div>
              </div>
            </>
          );
        })()}

        {/* Progress bar — how much of original debt is paid off */}
        {payoff.monthsRemaining !== Infinity && payoff.monthsRemaining > 0 && startDate && (
          <div>
            <div className="h-2 w-full rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-green-500 transition-all"
                style={{
                  width: `${Math.max(5, Math.min(95, (1 - payoff.monthsRemaining / (payoff.monthsRemaining + Math.max(1, Math.round((Date.now() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24 * 30.44))))) * 100))}%`,
                }}
              />
            </div>
          </div>
        )}

        {isMortgage && lvr && (
          <div className="border-t pt-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">LVR</span>
              <span className={`font-medium ${lvr.lvr > 80 ? "text-red-600" : "text-green-600"}`}>
                {lvr.lvr.toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Equity</span>
              <span className="font-medium">{fmt(lvr.equity)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Available equity</span>
              <span className="font-medium">{fmt(lvr.availableEquity)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
