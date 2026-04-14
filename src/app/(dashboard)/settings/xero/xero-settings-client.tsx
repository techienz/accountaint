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

interface XeroSettingsClientProps {
  isConnected: boolean;
  tenantName: string | null;
  lastSyncAt: string | null;
  isStale: boolean;
}

export function XeroSettingsClient({
  isConnected,
  tenantName,
  lastSyncAt,
  isStale,
}: XeroSettingsClientProps) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  async function handleSync() {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const response = await fetch("/api/xero/sync", { method: "POST" });
      const data = await response.json();
      if (data.success) {
        setSyncMessage("All data synced successfully.");
      } else {
        const failures = data.results
          ?.filter((r: { success: boolean }) => !r.success)
          .map((r: { entityType: string; error?: string }) => r.entityType)
          .join(", ");
        setSyncMessage(
          `Sync completed with errors in: ${failures || "unknown"}`
        );
      }
      router.refresh();
    } catch {
      setSyncMessage("Failed to sync. Please try again.");
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    if (
      !confirm(
        "Are you sure you want to disconnect Xero? This will remove all cached data."
      )
    ) {
      return;
    }
    setDisconnecting(true);
    try {
      await fetch("/api/xero/disconnect", { method: "POST" });
      router.refresh();
    } catch {
      // Refresh anyway to show current state
      router.refresh();
    } finally {
      setDisconnecting(false);
    }
  }

  function handleConnect() {
    window.location.href = "/api/xero/connect";
  }

  const formattedSyncTime = lastSyncAt
    ? new Date(lastSyncAt).toLocaleString("en-NZ", { timeZone: "Pacific/Auckland" })
    : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Xero Integration</CardTitle>
            <CardDescription>
              Connect your Xero account to sync financial data.
            </CardDescription>
          </div>
          <Badge variant={isConnected ? "default" : "secondary"}>
            {isConnected ? "Connected" : "Disconnected"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected ? (
          <>
            {tenantName && (
              <div className="text-sm">
                <span className="text-muted-foreground">Organisation: </span>
                <span className="font-medium">{tenantName}</span>
              </div>
            )}

            {formattedSyncTime && (
              <div className="text-sm">
                <span className="text-muted-foreground">Last synced: </span>
                <span className="font-medium">{formattedSyncTime}</span>
                {isStale && (
                  <Badge variant="outline" className="ml-2 text-amber-600">
                    Stale
                  </Badge>
                )}
              </div>
            )}

            {!formattedSyncTime && (
              <p className="text-sm text-muted-foreground">
                No data synced yet. Click &quot;Sync Now&quot; to pull data from
                Xero.
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
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Connect your Xero account to automatically sync your financial
              data, including invoices, contacts, bank accounts, and reports.
            </p>
            <Button onClick={handleConnect}>Connect Xero</Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
