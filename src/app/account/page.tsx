import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getBillingEnv } from "@/lib/billing/env";
import { getSignedInUser } from "@/lib/billing/entitlements";
import { loadPlans, METRICS } from "@/lib/billing/plans";
import { fetchPlanRows } from "@/lib/billing/store";
import { buildAccountSummary, type AccountSummary } from "@/lib/billing/summary";
import { METRIC_LABELS, meterText } from "@/components/billing/format";
import { BillingActions } from "@/components/billing/BillingActions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Account | Aristo" };

const STATUS_TEXT: Record<string, string> = {
  active: "Active",
  trialing: "Trial",
  past_due: "Payment overdue: Paddle is retrying the payment",
  paused: "Paused",
  canceled: "Canceled",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

function Meter({ id, label, used, limit }: { id: string; label: string; used: number; limit: number }) {
  const { text, percent } = meterText(used, limit);
  return (
    <li className="space-y-1">
      <div className="flex justify-between gap-4 text-sm">
        <span id={`${id}-label`} className="text-ink">{label}</span>
        <span className="text-body">{text}</span>
      </div>
      {limit > 0 && (
        <div
          role="meter"
          aria-labelledby={`${id}-label`}
          aria-valuemin={0}
          aria-valuemax={limit}
          aria-valuenow={Math.min(used, limit)}
          aria-valuetext={text}
          className="h-2 w-full overflow-hidden rounded-full bg-sunk"
        >
          <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
        </div>
      )}
    </li>
  );
}

export default async function AccountPage() {
  const user = await getSignedInUser();
  if (!user) redirect("/sign-in");

  let summary: AccountSummary | null = null;
  let planNames: Record<string, string> = {};
  try {
    const env = getBillingEnv();
    summary = await buildAccountSummary(user, env);
    planNames = Object.fromEntries((await loadPlans(fetchPlanRows)).map((p) => [p.id, p.name]));
  } catch {
    console.error("[account] summary failed");
  }

  return (
    <main className="min-h-screen bg-bg text-ink px-4 py-12">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="flex flex-wrap items-baseline justify-between gap-4">
          <h1 className="type-h1 font-semibold">Account</h1>
          <Link href="/learn" className="text-sm font-semibold text-accent-text underline-offset-4 hover:underline">
            Back to learning
          </Link>
        </header>

        {!summary ? (
          <p className="rounded-2xl border border-line bg-surface p-6 text-body" role="alert">
            Your account details could not be loaded right now. Please try again later.
          </p>
        ) : (
          <>
            <section aria-labelledby="plan-heading" className="rounded-2xl border border-line bg-surface p-6 space-y-3">
              <h2 id="plan-heading" className="type-h3 font-semibold">
                Plan: {summary.plan.name}
              </h2>
              {summary.subscription && (
                <p className="text-sm text-body">
                  Status: {STATUS_TEXT[summary.subscription.status] ?? summary.subscription.status}
                  {summary.subscription.currentPeriodEnd &&
                    (summary.subscription.cancelAtPeriodEnd
                      ? `. Ends on ${formatDate(summary.subscription.currentPeriodEnd)}.`
                      : `. Renews on ${formatDate(summary.subscription.currentPeriodEnd)}.`)}
                </p>
              )}
              {summary.isOwner && summary.billingEnabled ? (
                <BillingActions checkout={summary.checkout} canManage={summary.canManage} planNames={planNames} />
              ) : (
                <p className="text-sm text-muted">
                  {summary.billingEnabled
                    ? "Billing is managed by the account owner."
                    : "Paid plans are not available yet."}{" "}
                  <Link href="/pricing" className="font-semibold text-accent-text underline-offset-4 hover:underline">
                    See plans
                  </Link>
                </p>
              )}
            </section>

            <section aria-labelledby="usage-heading" className="rounded-2xl border border-line bg-surface p-6 space-y-4">
              <div>
                <h2 id="usage-heading" className="type-h3 font-semibold">This period</h2>
                <p className="text-sm text-muted">
                  Resets on {formatDate(summary.period.end)}.
                  {!summary.enforceAllowance && " Limits are shown for information and are not applied yet."}
                </p>
              </div>
              <ul className="space-y-4">
                {METRICS.map((m) => (
                  <Meter key={m} id={`meter-${m}`} label={METRIC_LABELS[m]} used={summary.usage[m]} limit={summary.limits[m]} />
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
