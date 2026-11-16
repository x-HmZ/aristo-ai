/**
 * One Zod-parsed view of the env vars billing and allowances read.
 *
 * Safety rules this file enforces (owner constraint: no live charge by accident):
 *   - BILLING_ENABLED defaults to off. Off: no checkout, no portal, webhook is a 404.
 *   - The Paddle environment is an explicit value (`sandbox` | `live`), never a default, whenever billing is on.
 *   - `live` additionally needs BILLING_ALLOW_LIVE=true.
 *   - Keys must carry the prefix of the environment they claim, so a live key can never sit in a sandbox config
 *     or the other way round. Prefixes from Paddle's docs:
 *       API keys `pdl_sdbx_apikey_` / `pdl_live_apikey_`: https://developer.paddle.com/api-reference/about/authentication
 *       client-side tokens `test_` / `live_`: https://developer.paddle.com/paddle-js/about/client-side-tokens
 *
 * Flags accept only "true" or "false" (or unset). Anything else is a configuration error, reported clearly,
 * rather than silently read as off or on.
 */

import { z } from "zod";

const flag = (fallback: boolean) =>
  z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? fallback : v === "true"));

const emptyToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const FlagsSchema = z.object({
  BILLING_ENABLED: z.preprocess(emptyToUndefined, flag(false)),
  ENFORCE_ALLOWANCE: z.preprocess(emptyToUndefined, flag(false)),
  BILLING_ALLOW_LIVE: z.preprocess(emptyToUndefined, flag(false)),
  NEXT_PUBLIC_PRICES_PROVISIONAL: z.preprocess(emptyToUndefined, flag(true)),
  NEXT_PUBLIC_CONTACT_EMAIL: z.preprocess(emptyToUndefined, z.email().max(200).optional()),
  /** Days a past_due subscription keeps its paid plan while Paddle retries the payment. */
  BILLING_GRACE_DAYS: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).max(30).default(7)),
});

const PaddleSchema = z.object({
  PADDLE_ENVIRONMENT: z.enum(["sandbox", "live"], {
    error: "PADDLE_ENVIRONMENT must be set to sandbox or live when BILLING_ENABLED=true",
  }),
  PADDLE_API_KEY: z.string().min(1, "PADDLE_API_KEY is required when BILLING_ENABLED=true"),
  PADDLE_WEBHOOK_SECRET: z.string().min(1, "PADDLE_WEBHOOK_SECRET is required when BILLING_ENABLED=true"),
  PADDLE_CLIENT_TOKEN: z.string().min(1, "PADDLE_CLIENT_TOKEN is required when BILLING_ENABLED=true"),
});

export type PaddleEnvironment = "sandbox" | "live";

export interface PaddleConfig {
  environment: PaddleEnvironment;
  apiKey: string;
  webhookSecret: string;
  clientToken: string;
}

export interface BillingEnv {
  billingEnabled: boolean;
  enforceAllowance: boolean;
  pricesProvisional: boolean;
  contactEmail: string | null;
  graceDays: number;
  /** Present exactly when billingEnabled is true. */
  paddle: PaddleConfig | null;
}

export class BillingConfigError extends Error {
  constructor(message: string) {
    super(`Billing configuration: ${message}`);
    this.name = "BillingConfigError";
  }
}

const KEY_PREFIX: Record<PaddleEnvironment, { apiKey: string; clientToken: string }> = {
  sandbox: { apiKey: "pdl_sdbx_apikey_", clientToken: "test_" },
  live: { apiKey: "pdl_live_apikey_", clientToken: "live_" },
};

function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  const path = issue?.path.join(".") || "env";
  return `${path}: ${issue?.message ?? "invalid"}`;
}

/** Pure: parse a given env record. Throws BillingConfigError on a bad value. */
export function parseBillingEnv(source: Record<string, string | undefined>): BillingEnv {
  const flags = FlagsSchema.safeParse(source);
  if (!flags.success) throw new BillingConfigError(firstIssue(flags.error));
  const f = flags.data;

  const base = {
    billingEnabled: f.BILLING_ENABLED,
    enforceAllowance: f.ENFORCE_ALLOWANCE,
    pricesProvisional: f.NEXT_PUBLIC_PRICES_PROVISIONAL,
    contactEmail: f.NEXT_PUBLIC_CONTACT_EMAIL ?? null,
    graceDays: f.BILLING_GRACE_DAYS,
  };

  // Billing off: Paddle values are not read at all, so a half-filled config cannot break the site.
  if (!f.BILLING_ENABLED) return { ...base, paddle: null };

  const p = PaddleSchema.safeParse(source);
  if (!p.success) throw new BillingConfigError(firstIssue(p.error));
  const environment = p.data.PADDLE_ENVIRONMENT;

  if (environment === "live" && !f.BILLING_ALLOW_LIVE) {
    throw new BillingConfigError("PADDLE_ENVIRONMENT=live also needs BILLING_ALLOW_LIVE=true");
  }
  // The sandbox accepts test cards, so on the production deployment anyone could "buy" a paid plan for nothing.
  // Sandbox billing belongs on preview deployments and local runs only.
  if (environment === "sandbox" && source.VERCEL_ENV === "production") {
    throw new BillingConfigError("PADDLE_ENVIRONMENT=sandbox is refused on the production deployment");
  }

  const prefix = KEY_PREFIX[environment];
  if (!p.data.PADDLE_API_KEY.startsWith(prefix.apiKey)) {
    throw new BillingConfigError(`PADDLE_API_KEY is not a ${environment} key (expected prefix ${prefix.apiKey})`);
  }
  if (!p.data.PADDLE_CLIENT_TOKEN.startsWith(prefix.clientToken)) {
    throw new BillingConfigError(
      `PADDLE_CLIENT_TOKEN is not a ${environment} token (expected prefix ${prefix.clientToken})`,
    );
  }

  return {
    ...base,
    paddle: {
      environment,
      apiKey: p.data.PADDLE_API_KEY,
      webhookSecret: p.data.PADDLE_WEBHOOK_SECRET,
      clientToken: p.data.PADDLE_CLIENT_TOKEN,
    },
  };
}

let cached: BillingEnv | null = null;

/** The process's billing env, parsed once. Throws BillingConfigError on a bad value. */
export function getBillingEnv(): BillingEnv {
  if (!cached) cached = parseBillingEnv(process.env);
  return cached;
}

/** Test hook: forget the parsed env. */
export function resetBillingEnvCache(): void {
  cached = null;
}
