"use client";

/**
 * Upgrade and manage-billing buttons on /account. Rendered only for an account owner while billing is on.
 *
 * Checkout is Paddle.js's overlay: Paddle is the merchant of record, so its checkout carries the legal texts
 * (terms, withdrawal, tax) and collects the payment details. This app never builds a payment form or sees card
 * data. Initialisation with a client-side token and `environment`, and Checkout.open with items, customer email
 * and customData: https://developer.paddle.com/paddle-js/about/client-side-tokens and the @paddle/paddle-js
 * README (initializePaddle, CheckoutOpenOptions). The account id travels as customData; the webhook checks it.
 */

import { useState } from "react";
import { initializePaddle, type Paddle } from "@paddle/paddle-js";
import { Button } from "@/components/ui/button";
import type { CheckoutConfig } from "@/lib/billing/summary";

interface Props {
  checkout: CheckoutConfig | null;
  canManage: boolean;
  planNames: Record<string, string>;
}

let paddlePromise: Promise<Paddle | undefined> | null = null;

function loadPaddle(config: CheckoutConfig): Promise<Paddle | undefined> {
  if (!paddlePromise) {
    paddlePromise = initializePaddle({
      token: config.clientToken,
      // Paddle.js names live "production".
      environment: config.environment === "live" ? "production" : "sandbox",
    });
  }
  return paddlePromise;
}

export function BillingActions({ checkout, canManage, planNames }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function buy(priceId: string) {
    if (!checkout) return;
    setBusy(true);
    setMessage(null);
    try {
      const paddle = await loadPaddle(checkout);
      if (!paddle) throw new Error("load");
      paddle.Checkout.open({
        items: [{ priceId, quantity: 1 }],
        ...(checkout.email ? { customer: { email: checkout.email } } : {}),
        customData: checkout.customData,
        settings: { displayMode: "overlay" },
      });
      setMessage("Your plan updates here a few moments after payment.");
    } catch {
      setMessage("The checkout could not be opened. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function manage() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const body = (await res.json().catch(() => null)) as { url?: unknown } | null;
      if (!res.ok || typeof body?.url !== "string" || !body.url.startsWith("https://")) throw new Error("portal");
      window.location.assign(body.url);
    } catch {
      setMessage("The billing portal could not be opened. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {checkout?.prices.map((p) => (
          <Button key={p.priceId} type="button" disabled={busy} onClick={() => buy(p.priceId)}>
            Upgrade to {planNames[p.planId] ?? p.planId}, billed {p.interval === "month" ? "monthly" : "yearly"}
          </Button>
        ))}
        {canManage && (
          <Button type="button" variant="outline" disabled={busy} onClick={manage}>
            Manage billing
          </Button>
        )}
      </div>
      {checkout && checkout.prices.length === 0 && (
        <p className="text-sm text-muted">Paid plans are not set up yet.</p>
      )}
      <p className="text-sm text-body" role="status" aria-live="polite">
        {message}
      </p>
    </div>
  );
}
