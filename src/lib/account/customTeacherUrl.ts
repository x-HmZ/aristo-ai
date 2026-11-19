/**
 * Which hosts may serve a custom (selfie) teacher's 3D model. The lesson loads the saved URL as a GLB straight
 * from the browser, so an arbitrary https URL would let any account point its lesson at a third-party host.
 *
 * Only Avaturn's own hosts are used by the feature: the export flow in src/app/create-teacher/CreateTeacherClient.tsx
 * embeds `https://<NEXT_PUBLIC_AVATURN_SUBDOMAIN>.avaturn.dev/` (the editor) and receives the exported model as a
 * data URL (never saved) or a hosted https URL on Avaturn's `avaturn.me` domain (the SDK documents avaturn.me as
 * its service domain). Nothing else is allowed.
 */

/** Hosts whose every subdomain (and the bare domain) may serve the model. */
export const CUSTOM_TEACHER_HOST_SUFFIXES = ["avaturn.me"] as const;

/** True when `value` is an https URL with no credentials or port on an allow-listed host. */
export function isAllowedCustomTeacherUrl(value: string, avaturnSubdomain: string | undefined = process.env.NEXT_PUBLIC_AVATURN_SUBDOMAIN): boolean {
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" || u.username || u.password || u.port) return false;
  const host = u.hostname.toLowerCase();
  if (CUSTOM_TEACHER_HOST_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`))) return true;
  // The project's own Avaturn subdomain only, never every avaturn.dev tenant.
  const own = avaturnSubdomain?.trim().toLowerCase();
  return !!own && /^[a-z0-9-]+$/.test(own) && host === `${own}.avaturn.dev`;
}
