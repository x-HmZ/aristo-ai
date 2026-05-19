/**
 * Resend wrapper.
 *
 * All transactional email goes through here so we have one place to
 * tune the from address, error handling, and logging. The Resend SDK
 * is lazy-imported so unrelated build steps don't pull it in.
 *
 * Required env:
 *   RESEND_API_KEY     — Resend project key.
 *   ADMIN_NOTIFY_EMAIL — destination for "new signup" notifications.
 *   APP_URL            — base URL used to build approval links (e.g.
 *                        "https://aristo.example.com"). Falls back to
 *                        VERCEL_URL on Vercel preview/prod.
 *
 * Optional env:
 *   RESEND_FROM        — sender address. Defaults to the Resend
 *                        sandbox domain (onboarding@resend.dev) so the
 *                        first deploy works without DNS setup.
 */

import { Resend } from "resend";

interface AdminSignupNotice {
  userId: string;
  email: string;
  fullName: string | null;
  createdAt: string;
}

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

function getAppUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

function getFrom(): string {
  return process.env.RESEND_FROM ?? "Aristo AI <onboarding@resend.dev>";
}

/**
 * Notify-once helper. Looks up the profile via the service client and
 * sends the admin notification if it's still pending AND hasn't been
 * sent before. Idempotent — safe to call from multiple entry points
 * (auth callback, /pending page).
 */
export async function notifyAdminOfNewSignup(
  userId: string,
  email: string
): Promise<void> {
  const { createServiceClient } = await import("@/lib/supabase/server");
  const service = createServiceClient();

  const { data: profile } = await service
    .from("profiles")
    .select("full_name, approval_status, admin_notified_at")
    .eq("id", userId)
    .single();

  if (
    !profile ||
    profile.approval_status !== "pending" ||
    profile.admin_notified_at
  ) {
    return;
  }

  const sent = await sendAdminNewSignupEmail({
    userId,
    email,
    fullName: profile.full_name ?? null,
    createdAt: new Date().toISOString(),
  });

  if (sent) {
    await service
      .from("profiles")
      .update({ admin_notified_at: new Date().toISOString() })
      .eq("id", userId);
  }
}

/**
 * Notify the configured admin email that a new user signed up and is
 * awaiting approval. Fail-soft: returns false on any error so the
 * caller can decide whether to mark the profile as notified.
 */
export async function sendAdminNewSignupEmail(
  notice: AdminSignupNotice
): Promise<boolean> {
  const resend = getResend();
  const to = process.env.ADMIN_NOTIFY_EMAIL;
  if (!resend || !to) {
    console.warn(
      "[email] Resend not configured — skipping new-signup notification"
    );
    return false;
  }

  const approvalUrl = `${getAppUrl()}/admin/users?userId=${notice.userId}`;
  const displayName = notice.fullName || notice.email;

  try {
    const { error } = await resend.emails.send({
      from: getFrom(),
      to,
      subject: `Aristo AI — new signup awaiting approval: ${displayName}`,
      html: `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; color: #1f1f1f;">
          <h2 style="color: #F97B2F;">New signup awaiting approval</h2>
          <p>A new user has signed up and is waiting for you to approve their access.</p>
          <table style="border-collapse: collapse; margin: 20px 0; font-size: 14px;">
            <tr><td style="padding: 4px 12px 4px 0; color: #666;">Name</td><td>${escapeHtml(displayName)}</td></tr>
            <tr><td style="padding: 4px 12px 4px 0; color: #666;">Email</td><td>${escapeHtml(notice.email)}</td></tr>
            <tr><td style="padding: 4px 12px 4px 0; color: #666;">User ID</td><td><code>${notice.userId}</code></td></tr>
            <tr><td style="padding: 4px 12px 4px 0; color: #666;">Signed up</td><td>${notice.createdAt}</td></tr>
          </table>
          <p>
            <a href="${approvalUrl}" style="display: inline-block; background: #F97B2F; color: white; padding: 10px 18px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              Review in admin panel
            </a>
          </p>
        </div>
      `,
    });

    if (error) {
      console.error("[email] Resend send failed", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email] Resend threw", err);
    return false;
  }
}

/**
 * Notify a user that their account was approved.
 */
export async function sendUserApprovedEmail(
  email: string,
  fullName: string | null
): Promise<boolean> {
  const resend = getResend();
  if (!resend) return false;

  const appUrl = getAppUrl();
  const displayName = fullName || "there";

  try {
    const { error } = await resend.emails.send({
      from: getFrom(),
      to: email,
      subject: "Welcome to Aristo AI — your account is ready",
      html: `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; color: #1f1f1f;">
          <h2 style="color: #F97B2F;">You're in!</h2>
          <p>Hi ${escapeHtml(displayName)},</p>
          <p>Your Aristo AI account has been approved. Sign in to start learning.</p>
          <p>
            <a href="${appUrl}/sign-in" style="display: inline-block; background: #F97B2F; color: white; padding: 10px 18px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              Open Aristo
            </a>
          </p>
        </div>
      `,
    });

    if (error) {
      console.error("[email] approval email failed", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email] approval email threw", err);
    return false;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
