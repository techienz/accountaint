"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [showReset, setShowReset] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    fetch("/api/auth/setup")
      .then((r) => r.json())
      .then((data) => {
        if (data.needsSetup) {
          router.replace("/setup");
        } else {
          setCheckingSetup(false);
        }
      })
      .catch(() => setCheckingSetup(false));
  }, [router]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: formData.get("email"),
        password: formData.get("pin"),
      }),
    });

    const data = await res.json();
    if (data.error) {
      setError(data.error);
      setLoading(false);
    } else {
      router.push("/");
      router.refresh();
    }
  }

  async function handleReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setResetting(true);
    setResetError("");

    const formData = new FormData(e.currentTarget);
    const email = formData.get("reset_email") as string;
    const currentPin = formData.get("current_pin") as string;
    const newPin = formData.get("new_pin") as string;
    const confirmPin = formData.get("confirm_pin") as string;

    if (!/^\d{4}$/.test(newPin)) {
      setResetError("New PIN must be exactly 4 digits");
      setResetting(false);
      return;
    }

    if (newPin !== confirmPin) {
      setResetError("New PINs don't match");
      setResetting(false);
      return;
    }

    // Login to verify identity
    const loginRes = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: currentPin }),
    });

    const loginData = await loginRes.json();
    if (loginData.error) {
      setResetError("Email or current PIN is incorrect");
      setResetting(false);
      return;
    }

    // Change PIN
    const changeRes = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: currentPin, newPassword: newPin }),
    });

    const changeData = await changeRes.json();
    if (changeData.error) {
      setResetError(changeData.error);
      setResetting(false);
      return;
    }

    await fetch("/api/auth/logout", { method: "POST" });
    setResetSuccess(true);
    setResetting(false);
    setTimeout(() => {
      setShowReset(false);
      setResetSuccess(false);
    }, 3000);
  }

  if (checkingSetup) return null;

  if (showReset) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Reset PIN</CardTitle>
          <CardDescription>
            Enter your current PIN to set a new one.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {resetSuccess ? (
            <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-sm text-green-800">
              PIN changed successfully. You can now sign in with your new PIN.
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset_email">Email</Label>
                <Input id="reset_email" name="reset_email" type="email" required autoFocus />
              </div>
              <div className="space-y-2">
                <Label htmlFor="current_pin">Current PIN</Label>
                <Input
                  id="current_pin"
                  name="current_pin"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]{4}"
                  maxLength={4}
                  required
                  className="text-center tracking-[0.5em] text-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new_pin">New PIN</Label>
                <Input
                  id="new_pin"
                  name="new_pin"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]{4}"
                  maxLength={4}
                  required
                  className="text-center tracking-[0.5em] text-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm_pin">Confirm new PIN</Label>
                <Input
                  id="confirm_pin"
                  name="confirm_pin"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]{4}"
                  maxLength={4}
                  required
                  className="text-center tracking-[0.5em] text-lg"
                />
              </div>
              {resetError && (
                <p className="text-sm text-destructive">{resetError}</p>
              )}
              <Button type="submit" className="w-full" disabled={resetting}>
                {resetting ? "Resetting..." : "Reset PIN"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => { setShowReset(false); setResetError(""); }}
              >
                Back to sign in
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Sign in</CardTitle>
        <CardDescription>
          Sign in to your Accountaint account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoFocus />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="pin">PIN</Label>
              <button
                type="button"
                onClick={() => setShowReset(true)}
                className="text-xs text-primary hover:underline"
              >
                Forgot PIN?
              </button>
            </div>
            <Input
              id="pin"
              name="pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              required
              className="text-center tracking-[0.5em] text-lg"
            />
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <a href="/setup" className="text-primary hover:underline">
              Sign up
            </a>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
