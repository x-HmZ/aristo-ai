/**
 * How people get in, as the public copy needs to know it.
 *
 *   approval  every new account waits for an administrator (today's behaviour, and the default)
 *   open      anyone may sign up and start, within the free monthly allowance
 *
 * Read from NEXT_PUBLIC_ACCESS_MODE so the landing page and the legal text follow the launch setting. An unknown or
 * missing value means `approval`: the copy never promises more openness than was configured.
 */
export type AccessMode = "approval" | "open";

export function parseAccessMode(raw: string | undefined): AccessMode {
  return raw?.trim().toLowerCase() === "open" ? "open" : "approval";
}

export const accessMode: AccessMode = parseAccessMode(process.env.NEXT_PUBLIC_ACCESS_MODE);

/** The first promise on the landing page's parents band, for each mode. */
export function accessPromise(mode: AccessMode): { title: string; body: string } {
  if (mode === "open") {
    return {
      title: "Free to Start, With a Monthly Allowance",
      body: "Anyone can create an account and start. Each account has a free allowance of new lessons every month. When it runs out, Aristo says so and shows the plans.",
    };
  }
  return {
    title: "Every Account Is Approved by Hand",
    body: "A new account waits for an administrator to approve it. Lessons start only after that.",
  };
}
