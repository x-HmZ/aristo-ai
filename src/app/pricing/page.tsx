import Link from "next/link";
import type { Metadata } from "next";
import { getBillingEnv, type BillingEnv } from "@/lib/billing/env";
import { loadPlans, type Plan } from "@/lib/billing/plans";
import { fetchPlanRows } from "@/lib/billing/store";
import { formatPrice, limitLines } from "@/components/billing/format";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pricing | Aristo",
  description: "Aristo plans: a free allowance for every learner, and family and organisation plans.",
};

/** Billing env without failing the page: a bad billing config shows plans with no buy buttons. */
function safeEnv(): Pick<BillingEnv, "billingEnabled" | "pricesProvisional" | "contactEmail"> {
  try {
    return getBillingEnv();
  } catch {
    return { billingEnabled: false, pricesProvisional: true, contactEmail: null };
  }
}

function PriceLine({ plan }: { plan: Plan }) {
  const per = plan.perSeat ? " per seat" : "";
  const month = [formatPrice(plan.prices.monthEur, "EUR"), formatPrice(plan.prices.monthUsd, "USD")].filter(Boolean);
  const year = [formatPrice(plan.prices.yearEur, "EUR"), formatPrice(plan.prices.yearUsd, "USD")].filter(Boolean);
  if (plan.id === "free") return <p className="type-h3 font-semibold text-ink">Free</p>;
  return (
    <div className="space-y-1">
      {month.length > 0 && (
        <p className="type-h3 font-semibold text-ink">
          {month.join(" / ")} <span className="text-sm font-normal text-muted">a month{per}</span>
        </p>
      )}
      {year.length > 0 && (
        <p className="text-sm text-body">
          or {year.join(" / ")} a year{per}
        </p>
      )}
    </div>
  );
}

function PlanAction({ plan, env }: { plan: Plan; env: ReturnType<typeof safeEnv> }) {
  if (plan.id === "free") {
    return (
      <Link href="/sign-up" className={buttonVariants({ variant: "outline", className: "w-full" })}>
        Start free
      </Link>
    );
  }
  if (plan.contactOnly) {
    if (!env.contactEmail) return <p className="text-sm text-muted">Not available yet.</p>;
    return (
      <a
        href={`mailto:${env.contactEmail}?subject=${encodeURIComponent(`Aristo ${plan.name}`)}`}
        className={buttonVariants({ variant: "outline", className: "w-full" })}
      >
        Contact us
      </a>
    );
  }
  if (!env.billingEnabled) return <p className="text-sm text-muted">Not available yet.</p>;
  // Checkout opens from /account, where the signed-in account owner is known.
  return (
    <Link href="/account" className={buttonVariants({ className: "w-full" })}>
      Choose {plan.name}
    </Link>
  );
}

export default async function PricingPage() {
  const env = safeEnv();
  let plans: Plan[] = [];
  let failed = false;
  try {
    plans = (await loadPlans(fetchPlanRows)).filter((p) => p.isPublic);
  } catch {
    failed = true;
  }

  return (
    <main className="min-h-screen bg-bg text-ink px-4 py-12">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 space-y-3">
          <h1 className="type-h1 font-semibold">Plans</h1>
          <p className="type-copy text-body">
            Every learner starts with a free monthly allowance. Families and organisations can get more.
          </p>
          {env.pricesProvisional && (
            <p className="rounded-[10px] border border-tint-line bg-tint px-4 py-3 text-sm text-ink" role="note">
              Prices are provisional and may change before paid plans open.
            </p>
          )}
        </header>

        {failed ? (
          <p className="text-body" role="alert">
            Plans could not be loaded right now. Please try again later.
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => (
              <li key={plan.id} className="flex flex-col rounded-2xl border border-line bg-surface p-6">
                <h2 className="type-h3 font-semibold mb-3">{plan.name}</h2>
                <PriceLine plan={plan} />
                <ul className="mt-4 mb-6 flex-1 space-y-1 text-sm text-body">
                  {limitLines(plan.limits, plan.perSeat).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                <PlanAction plan={plan} env={env} />
              </li>
            ))}
          </ul>
        )}

        <p className="mt-8 text-sm text-muted">
          EUR prices include VAT; USD prices are before sales tax. Payments, tax and invoices are handled by our
          reseller, Paddle, once paid plans open.
        </p>
      </div>
    </main>
  );
}
