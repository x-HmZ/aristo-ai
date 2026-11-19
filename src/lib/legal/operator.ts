/**
 * Who runs the service, read from configuration. Nothing here is ever hardcoded: a name, a town, an address or an
 * email is either set in the environment or absent, and the legal pages say "draft, not yet in force" until the
 * required ones are present.
 *
 * Each NEXT_PUBLIC_ variable is read by its literal name so the bundler can inline it for client components
 * (the footer is one). Do not replace `readOperatorEnv` with a loop over keys.
 */

export interface OperatorEnv {
  NEXT_PUBLIC_OPERATOR_NAME?: string;
  NEXT_PUBLIC_OPERATOR_TOWN?: string;
  NEXT_PUBLIC_OPERATOR_COUNTRY?: string;
  NEXT_PUBLIC_CONTACT_EMAIL?: string;
  NEXT_PUBLIC_OPERATOR_ADDRESS?: string;
}

export interface Operator {
  /** Full name of the person who operates the service (a natural person, no company). */
  name: string | null;
  town: string | null;
  country: string;
  /** Postal address; optional in configuration, but the imprint needs it to be in force. */
  address: string | null;
  email: string | null;
  /** Name, town and contact email are present: the privacy policy, terms and parent notice may go live. */
  complete: boolean;
  /** Everything `complete` needs plus the postal address: the imprint may go live. */
  imprintComplete: boolean;
  /** Environment variable names still unset, for the draft notice. */
  missing: string[];
  missingForImprint: string[];
}

export const DEFAULT_COUNTRY = "Austria";

export function readOperatorEnv(): OperatorEnv {
  return {
    NEXT_PUBLIC_OPERATOR_NAME: process.env.NEXT_PUBLIC_OPERATOR_NAME,
    NEXT_PUBLIC_OPERATOR_TOWN: process.env.NEXT_PUBLIC_OPERATOR_TOWN,
    NEXT_PUBLIC_OPERATOR_COUNTRY: process.env.NEXT_PUBLIC_OPERATOR_COUNTRY,
    NEXT_PUBLIC_CONTACT_EMAIL: process.env.NEXT_PUBLIC_CONTACT_EMAIL,
    NEXT_PUBLIC_OPERATOR_ADDRESS: process.env.NEXT_PUBLIC_OPERATOR_ADDRESS,
  };
}

function clean(v: string | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

/** A deliberately loose shape check: one @, something either side, a dot after it, no spaces. */
export function isPlausibleEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export function resolveOperator(env: OperatorEnv): Operator {
  const name = clean(env.NEXT_PUBLIC_OPERATOR_NAME);
  const town = clean(env.NEXT_PUBLIC_OPERATOR_TOWN);
  const rawEmail = clean(env.NEXT_PUBLIC_CONTACT_EMAIL);
  const email = rawEmail && isPlausibleEmail(rawEmail) ? rawEmail : null;
  const address = clean(env.NEXT_PUBLIC_OPERATOR_ADDRESS);
  const country = clean(env.NEXT_PUBLIC_OPERATOR_COUNTRY) ?? DEFAULT_COUNTRY;

  const missing: string[] = [];
  if (!name) missing.push("NEXT_PUBLIC_OPERATOR_NAME");
  if (!town) missing.push("NEXT_PUBLIC_OPERATOR_TOWN");
  if (!email) missing.push("NEXT_PUBLIC_CONTACT_EMAIL");
  const missingForImprint = address ? missing : [...missing, "NEXT_PUBLIC_OPERATOR_ADDRESS"];

  return {
    name,
    town,
    country,
    address,
    email,
    complete: missing.length === 0,
    imprintComplete: missingForImprint.length === 0,
    missing,
    missingForImprint,
  };
}

export const operator: Operator = resolveOperator(readOperatorEnv());

/** `mailto:` link for the "Report a problem" entries; null when no contact address is configured. */
export function reportProblemHref(op: Operator = operator): string | null {
  if (!op.email) return null;
  return `mailto:${op.email}?subject=${encodeURIComponent("Aristo: report a problem")}`;
}
