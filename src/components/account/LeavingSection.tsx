"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** "Download my data" and "Delete my account" (type DELETE to confirm). */
export function LeavingSection() {
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onDelete(e: React.FormEvent) {
    e.preventDefault();
    if (confirm !== "DELETE" || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm }),
      });
      if (res.ok) {
        window.location.assign("/account/deleted");
        return;
      }
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "We could not delete the account. Please try again.");
    } catch {
      setError("We could not reach the server. Please try again.");
    }
    setBusy(false);
  }

  return (
    <section aria-labelledby="leaving-heading" className="rounded-2xl border border-line bg-surface p-6 space-y-6">
      <h2 id="leaving-heading" className="type-h3 font-semibold">Your data</h2>

      <div className="space-y-2">
        <p className="text-sm text-body">
          Download everything we keep about this account (profile, lessons progress, quiz answers, consents) as one file.
        </p>
        <Button asChild variant="outline">
          <a href="/api/account/export" download>Download my data</a>
        </Button>
      </div>

      <form onSubmit={onDelete} className="space-y-3 border-t border-line pt-6">
        <h3 className="text-base font-semibold text-ink">Delete my account</h3>
        <p className="text-sm text-body">
          This permanently deletes the account, the learner&apos;s progress and answers, and your consent records. It cannot
          be undone. If you pay for a plan, cancel billing first.
        </p>
        <div className="space-y-2">
          <Label htmlFor="delete-confirm">Type DELETE to confirm</Label>
          <Input
            id="delete-confirm"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="off"
            aria-describedby={error ? "delete-error" : undefined}
          />
        </div>
        {error && (
          <p id="delete-error" role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" variant="destructive" disabled={confirm !== "DELETE" || busy}>
          {busy ? "Deleting..." : "Delete my account"}
        </Button>
      </form>
    </section>
  );
}
