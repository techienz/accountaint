"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Status =
  | "loading"
  | "unsupported"
  | "denied"
  | "not_enabled"
  | "enabled"
  | "no_vapid";

function urlBase64ToUint8Array(base64: string): BufferSource {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; ++i) view[i] = raw.charCodeAt(i);
  return buffer;
}

export function DesktopPushControl() {
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [vapidPublicKey, setVapidPublicKey] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    try {
      const res = await fetch("/api/notifications/push-status");
      const data = await res.json();
      if (!data.configured) {
        setStatus("no_vapid");
        return;
      }
      setVapidPublicKey(data.vapid_public_key);

      if (Notification.permission === "denied") {
        setStatus("denied");
        return;
      }

      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const existing = reg ? await reg.pushManager.getSubscription() : null;
      setStatus(existing && data.subscription_count > 0 ? "enabled" : "not_enabled");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Status check failed");
      setStatus("not_enabled");
    }
  }

  async function enable() {
    if (!vapidPublicKey) return;
    setBusy(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        setMessage("Permission denied. Allow notifications in your browser settings to enable.");
        return;
      }

      const reg =
        (await navigator.serviceWorker.getRegistration("/sw.js")) ||
        (await navigator.serviceWorker.register("/sw.js"));
      await navigator.serviceWorker.ready;

      let subscription = await reg.pushManager.getSubscription();
      if (!subscription) {
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
      }

      const json = subscription.toJSON();
      const res = await fetch("/api/notifications/push-subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: json.keys,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to save subscription");
      }
      setStatus("enabled");
      setMessage("Browser notifications enabled.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to enable");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMessage(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const subscription = reg ? await reg.pushManager.getSubscription() : null;

      if (subscription) {
        await fetch("/api/notifications/push-unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setStatus("not_enabled");
      setMessage("Browser notifications disabled.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to disable");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/notifications/push-test", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Test failed");
      setMessage(`Test sent to ${data.sent_to_subscriptions} browser(s). Check for the notification.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Test failed");
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading") {
    return <p className="text-sm text-muted-foreground">Checking push status...</p>;
  }

  if (status === "unsupported") {
    return (
      <p className="text-sm text-muted-foreground">
        Your browser doesn&apos;t support push notifications.
      </p>
    );
  }

  if (status === "no_vapid") {
    return (
      <p className="text-sm text-muted-foreground">
        VAPID keys not configured on the server. Set <code>VAPID_PUBLIC_KEY</code>,{" "}
        <code>VAPID_PRIVATE_KEY</code>, and <code>VAPID_EMAIL</code> in your environment.
      </p>
    );
  }

  if (status === "denied") {
    return (
      <p className="text-sm text-amber-600 dark:text-amber-400">
        Notification permission was denied. To enable, change the site&apos;s notification
        permission in your browser settings, then reload this page.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Status:{" "}
        <span className="font-medium text-foreground">
          {status === "enabled" ? "Subscribed" : "Not subscribed"}
        </span>
      </p>
      <div className="flex flex-wrap gap-2">
        {status === "enabled" ? (
          <>
            <Button variant="outline" size="sm" onClick={disable} disabled={busy}>
              {busy ? "Working..." : "Disable browser notifications"}
            </Button>
            <Button variant="outline" size="sm" onClick={sendTest} disabled={busy}>
              {busy ? "Sending..." : "Send test notification"}
            </Button>
          </>
        ) : (
          <Button variant="outline" size="sm" onClick={enable} disabled={busy}>
            {busy ? "Working..." : "Enable browser notifications"}
          </Button>
        )}
      </div>
      {message && (
        <p className="text-sm text-muted-foreground">{message}</p>
      )}
    </div>
  );
}
