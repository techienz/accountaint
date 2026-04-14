"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Account = {
  id: string;
  code: string;
  name: string;
  type: string;
  sub_type: string;
  is_system: boolean;
  is_active: boolean;
  gst_applicable: boolean;
};

type GroupedAccounts = Record<string, Account[]>;

const TYPE_LABELS: Record<string, string> = {
  asset: "Assets",
  liability: "Liabilities",
  equity: "Equity",
  revenue: "Revenue",
  expense: "Expenses",
};

const TYPE_COLORS: Record<string, string> = {
  asset: "text-blue-500",
  liability: "text-red-500",
  equity: "text-purple-500",
  revenue: "text-green-500",
  expense: "text-orange-500",
};

export function CoaClient({
  grouped,
  businessId,
}: {
  grouped: GroupedAccounts;
  businessId: string;
}) {
  const [adding, setAdding] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<string>("");
  const [saving, setSaving] = useState(false);

  async function addAccount() {
    if (!newCode || !newName || !newType) return;
    setSaving(true);
    try {
      await fetch("/api/ledger/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: newCode, name: newName, type: newType }),
      });
      window.location.reload();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(accountId: string, currentActive: boolean) {
    await fetch("/api/ledger/accounts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId, is_active: !currentActive }),
    });
    window.location.reload();
  }

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([type, accounts]) => (
        <div key={type} className="space-y-2">
          <h2 className={`text-lg font-semibold ${TYPE_COLORS[type]}`}>
            {TYPE_LABELS[type]}
          </h2>
          <div className="rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="px-4 py-2 text-left font-medium w-24">Code</th>
                  <th className="px-4 py-2 text-left font-medium">Name</th>
                  <th className="px-4 py-2 text-left font-medium w-28">Sub-type</th>
                  <th className="px-4 py-2 text-center font-medium w-16">GST</th>
                  <th className="px-4 py-2 text-right font-medium w-24"></th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr key={account.id} className="border-b last:border-0">
                    <td className="px-4 py-2 font-mono text-muted-foreground">
                      {account.code}
                    </td>
                    <td className="px-4 py-2">
                      {account.name}
                      {account.is_system && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          system
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground text-xs">
                      {account.sub_type.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {account.gst_applicable ? "Yes" : "—"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {!account.is_system && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleActive(account.id, account.is_active)}
                        >
                          {account.is_active ? "Deactivate" : "Activate"}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Add account form */}
      {adding ? (
        <div className="rounded-lg border p-4 space-y-3">
          <h3 className="font-medium">Add Account</h3>
          <div className="flex gap-3 items-end flex-wrap">
            <div>
              <label className="text-xs text-muted-foreground">Code</label>
              <Input
                className="w-24"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="6100"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-muted-foreground">Name</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Account name"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Type</label>
              <Select value={newType} onValueChange={(v) => v && setNewType(v)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asset">Asset</SelectItem>
                  <SelectItem value="liability">Liability</SelectItem>
                  <SelectItem value="equity">Equity</SelectItem>
                  <SelectItem value="revenue">Revenue</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={addAccount} disabled={saving || !newCode || !newName || !newType}>
              {saving ? "Saving..." : "Add"}
            </Button>
            <Button variant="outline" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" onClick={() => setAdding(true)}>
          + Add Account
        </Button>
      )}
    </div>
  );
}
