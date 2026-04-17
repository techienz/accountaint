"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AkahuAccount {
  id: string;
  name: string;
  institution: string;
  account_type: string;
  balance: number;
  available_balance: number | null;
  last_synced_at: string | null;
  linked_budget_account_id: string | null;
  linked_business_id: string | null;
  is_tax_savings: boolean;
}

interface BankFeedsClientProps {
  isConnected: boolean;
  isConfigured: boolean;
  accounts: AkahuAccount[];
  budgetAccounts: { id: string; name: string }[];
  businesses: { id: string; name: string }[];
}

export function BankFeedsClient({
  isConnected,
  isConfigured,
  accounts,
  budgetAccounts,
  businesses,
}: BankFeedsClientProps) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [linking, setLinking] = useState<string | null>(null);

  async function handleConnect() {
    window.location.href = "/api/akahu/connect";
  }

  async function handleDisconnect() {
    if (
      !confirm(
        "Are you sure you want to disconnect Akahu? This will remove all synced bank data."
      )
    ) {
      return;
    }
    setDisconnecting(true);
    try {
      await fetch("/api/akahu/disconnect", { method: "POST" });
      router.refresh();
    } catch {
      router.refresh();
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const response = await fetch("/api/akahu/sync", { method: "POST" });
      const data = await response.json();
      if (data.success) {
        const parts: string[] = [];
        if (data.accounts?.new > 0)
          parts.push(`${data.accounts.new} new account(s)`);
        if (data.transactions?.personal > 0)
          parts.push(`${data.transactions.personal} personal transaction(s)`);
        if (data.transactions?.business > 0)
          parts.push(`${data.transactions.business} business transaction(s)`);
        if (data.transactions?.duplicates > 0)
          parts.push(`${data.transactions.duplicates} duplicate(s) skipped`);
        setSyncMessage(
          parts.length > 0
            ? `Synced: ${parts.join(", ")}.`
            : "All up to date."
        );
        router.refresh();
      } else {
        setSyncMessage(data.error || "Sync failed. Please try again.");
      }
    } catch {
      setSyncMessage("Failed to sync. Please try again.");
    } finally {
      setSyncing(false);
    }
  }

  async function handleLinkChange(
    accountId: string,
    value: string | null
  ) {
    if (!value) return;
    setLinking(accountId);
    try {
      let linkType: "personal" | "business" | "none";
      let linkId: string | undefined;

      if (value === "none") {
        linkType = "none";
      } else if (value.startsWith("personal:")) {
        linkType = "personal";
        linkId = value.replace("personal:", "");
      } else if (value.startsWith("business:")) {
        linkType = "business";
        linkId = value.replace("business:", "");
      } else {
        return;
      }

      await fetch("/api/akahu/accounts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, linkType, linkId }),
      });
      router.refresh();
    } catch {
      // Refresh to show current state
      router.refresh();
    } finally {
      setLinking(null);
    }
  }

  function getCurrentLinkValue(account: AkahuAccount): string {
    if (account.linked_budget_account_id) {
      return `personal:${account.linked_budget_account_id}`;
    }
    if (account.linked_business_id) {
      return `business:${account.linked_business_id}`;
    }
    return "none";
  }

  function formatBalance(balance: number): string {
    return new Intl.NumberFormat("en-NZ", {
      style: "currency",
      currency: "NZD",
    }).format(balance);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Bank Feeds (Akahu)</CardTitle>
            <CardDescription>
              Connect your NZ bank accounts via Akahu for automatic transaction
              syncing.
            </CardDescription>
          </div>
          <Badge variant={isConnected ? "default" : "secondary"}>
            {isConnected ? "Connected" : "Disconnected"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {isConnected ? (
          <>
            {accounts.length > 0 ? (
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Bank Accounts</h3>
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex flex-col gap-2 rounded-lg border p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{account.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {account.institution} &middot;{" "}
                          {account.account_type}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">
                          {formatBalance(account.balance)}
                        </p>
                        {account.last_synced_at && (
                          <p className="text-xs text-muted-foreground">
                            Synced{" "}
                            {new Date(
                              account.last_synced_at
                            ).toLocaleString("en-NZ", { timeZone: "Pacific/Auckland" })}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        Link to:
                      </span>
                      <Select
                        value={getCurrentLinkValue(account)}
                        onValueChange={(value) =>
                          handleLinkChange(account.id, value)
                        }
                        disabled={linking === account.id}
                      >
                        <SelectTrigger className="w-[220px]">
                          <SelectValue placeholder="Not linked" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Not linked</SelectItem>
                          {budgetAccounts.length > 0 && (
                            <>
                              {budgetAccounts.map((ba) => (
                                <SelectItem
                                  key={ba.id}
                                  value={`personal:${ba.id}`}
                                >
                                  Personal: {ba.name}
                                </SelectItem>
                              ))}
                            </>
                          )}
                          {businesses.map((biz) => (
                            <SelectItem
                              key={biz.id}
                              value={`business:${biz.id}`}
                            >
                              Business: {biz.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <label className="flex items-center gap-1.5 text-sm text-muted-foreground ml-4">
                        <input
                          type="checkbox"
                          checked={account.is_tax_savings}
                          onChange={async (e) => {
                            await fetch(`/api/akahu/accounts`, {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ accountId: account.id, is_tax_savings: e.target.checked }),
                            });
                            router.refresh();
                          }}
                          className="h-3.5 w-3.5"
                        />
                        Tax savings
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No bank accounts found yet. Click &quot;Sync Now&quot; to fetch
                your accounts from Akahu.
              </p>
            )}

            {syncMessage && (
              <p className="text-sm text-muted-foreground">{syncMessage}</p>
            )}

            <div className="flex gap-2">
              <Button onClick={handleSync} disabled={syncing}>
                {syncing ? "Syncing..." : "Sync Now"}
              </Button>
              <Button
                variant="outline"
                onClick={handleDisconnect}
                disabled={disconnecting}
              >
                {disconnecting ? "Disconnecting..." : "Disconnect"}
              </Button>
            </div>
            <details className="mt-4">
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                Edit Akahu tokens
              </summary>
              <AkahuSetupForm onConfigured={() => router.refresh()} isUpdate />
            </details>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Connect your NZ bank accounts via Akahu to automatically sync
              transactions. Akahu supports all major NZ banks including ANZ,
              ASB, BNZ, Kiwibank, and Westpac.
            </p>
            <AkahuSetupForm onConfigured={() => router.refresh()} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function AkahuSetupForm({ onConfigured, isUpdate = false }: { onConfigured: () => void; isUpdate?: boolean }) {
  const [appToken, setAppToken] = useState("");
  const [userToken, setUserToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSave() {
    if (!appToken || !userToken) {
      setError("Both tokens are required");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);

    // Save tokens
    const res = await fetch("/api/integrations/akahu-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_token: appToken,
        user_token: userToken,
      }),
    });

    if (!res.ok) {
      setError("Failed to save tokens");
      setSaving(false);
      return;
    }

    // Test connection and sync accounts
    setConnecting(true);
    const connectRes = await fetch("/api/akahu/connect-personal", { method: "POST" });
    if (connectRes.ok) {
      const data = await connectRes.json();
      setSuccess(`Connected! Found ${data.accountCount} bank account${data.accountCount !== 1 ? "s" : ""}.`);
      onConfigured();
    } else {
      const err = await connectRes.json();
      setError(err.error || "Connection test failed. Check your tokens are correct.");
    }
    setConnecting(false);
    setSaving(false);
  }

  return (
    <div className="space-y-4 mt-4 p-4 border rounded-lg">
      <div>
        <h4 className="text-sm font-medium mb-1">{isUpdate ? "Update Akahu Tokens" : "Setup Akahu Personal App"}</h4>
        <p className="text-xs text-muted-foreground mb-3">
          Create a personal app at{" "}
          <a href="https://my.akahu.nz" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            my.akahu.nz
          </a>
          {" "}and copy your two tokens below. No OAuth flow needed.
        </p>
      </div>
      <div>
        <Label htmlFor="akahu-app-token">App ID Token</Label>
        <Input
          id="akahu-app-token"
          type="password"
          value={appToken}
          onChange={(e) => setAppToken(e.target.value)}
          placeholder="app_token_..."
        />
      </div>
      <div>
        <Label htmlFor="akahu-user-token">User Access Token</Label>
        <Input
          id="akahu-user-token"
          type="password"
          value={userToken}
          onChange={(e) => setUserToken(e.target.value)}
          placeholder="user_token_..."
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">{success}</p>}
      <Button onClick={handleSave} disabled={saving || connecting}>
        {connecting ? "Testing connection..." : saving ? "Saving..." : isUpdate ? "Update & Reconnect" : "Connect Akahu"}
      </Button>
    </div>
  );
}
