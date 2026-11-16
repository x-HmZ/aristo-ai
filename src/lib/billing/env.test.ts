import { describe, expect, it } from "vitest";
import { BillingConfigError, parseBillingEnv } from "./env";

const SANDBOX = {
  BILLING_ENABLED: "true",
  PADDLE_ENVIRONMENT: "sandbox",
  PADDLE_API_KEY: "pdl_sdbx_apikey_01abc",
  PADDLE_WEBHOOK_SECRET: "pdl_ntfset_secret",
  PADDLE_CLIENT_TOKEN: "test_abcdefghijklmnopqrstuvwxyz0",
};

const LIVE = {
  ...SANDBOX,
  PADDLE_ENVIRONMENT: "live",
  PADDLE_API_KEY: "pdl_live_apikey_01abc",
  PADDLE_CLIENT_TOKEN: "live_abcdefghijklmnopqrstuvwxyz0",
};

describe("parseBillingEnv", () => {
  it("defaults to everything off, provisional prices, no contact, 7 grace days", () => {
    const env = parseBillingEnv({});
    expect(env).toEqual({
      billingEnabled: false,
      enforceAllowance: false,
      pricesProvisional: true,
      contactEmail: null,
      graceDays: 7,
      paddle: null,
    });
  });

  it("does not read Paddle values while billing is off, even half-filled or live ones", () => {
    const env = parseBillingEnv({ PADDLE_ENVIRONMENT: "live", PADDLE_API_KEY: "nonsense" });
    expect(env.paddle).toBeNull();
  });

  it("parses a complete sandbox config", () => {
    const env = parseBillingEnv(SANDBOX);
    expect(env.billingEnabled).toBe(true);
    expect(env.paddle?.environment).toBe("sandbox");
  });

  it("requires an explicit environment when billing is on", () => {
    const { PADDLE_ENVIRONMENT: _omit, ...rest } = SANDBOX;
    void _omit;
    expect(() => parseBillingEnv(rest)).toThrow(BillingConfigError);
    expect(() => parseBillingEnv(rest)).toThrow(/PADDLE_ENVIRONMENT/);
  });

  it("names the missing secret", () => {
    expect(() => parseBillingEnv({ ...SANDBOX, PADDLE_WEBHOOK_SECRET: "" })).toThrow(/PADDLE_WEBHOOK_SECRET/);
  });

  it("refuses live without the second switch", () => {
    expect(() => parseBillingEnv(LIVE)).toThrow(/BILLING_ALLOW_LIVE/);
    expect(() => parseBillingEnv({ ...LIVE, BILLING_ALLOW_LIVE: "false" })).toThrow(/BILLING_ALLOW_LIVE/);
  });

  it("accepts live with both switches", () => {
    const env = parseBillingEnv({ ...LIVE, BILLING_ALLOW_LIVE: "true" });
    expect(env.paddle?.environment).toBe("live");
  });

  it("refuses keys from the other environment", () => {
    expect(() => parseBillingEnv({ ...SANDBOX, PADDLE_API_KEY: LIVE.PADDLE_API_KEY })).toThrow(/PADDLE_API_KEY/);
    expect(() => parseBillingEnv({ ...SANDBOX, PADDLE_CLIENT_TOKEN: LIVE.PADDLE_CLIENT_TOKEN })).toThrow(
      /PADDLE_CLIENT_TOKEN/,
    );
    expect(() =>
      parseBillingEnv({ ...LIVE, BILLING_ALLOW_LIVE: "true", PADDLE_API_KEY: SANDBOX.PADDLE_API_KEY }),
    ).toThrow(/PADDLE_API_KEY/);
  });

  it("rejects flag values other than true and false", () => {
    expect(() => parseBillingEnv({ BILLING_ENABLED: "1" })).toThrow(BillingConfigError);
    expect(() => parseBillingEnv({ ENFORCE_ALLOWANCE: "yes" })).toThrow(/ENFORCE_ALLOWANCE/);
  });

  it("reads the allowance switch, provisional flag, contact address and grace days", () => {
    const env = parseBillingEnv({
      ENFORCE_ALLOWANCE: "true",
      NEXT_PUBLIC_PRICES_PROVISIONAL: "false",
      NEXT_PUBLIC_CONTACT_EMAIL: "hello@example.org",
      BILLING_GRACE_DAYS: "3",
    });
    expect(env.enforceAllowance).toBe(true);
    expect(env.pricesProvisional).toBe(false);
    expect(env.contactEmail).toBe("hello@example.org");
    expect(env.graceDays).toBe(3);
  });

  it("rejects a malformed contact address and treats an empty one as unset", () => {
    expect(() => parseBillingEnv({ NEXT_PUBLIC_CONTACT_EMAIL: "not an email" })).toThrow(/CONTACT_EMAIL/);
    expect(parseBillingEnv({ NEXT_PUBLIC_CONTACT_EMAIL: "" }).contactEmail).toBeNull();
  });
});
