/**
 * Version of each legal document, as an ISO date (the day the text last changed in substance).
 *
 * Sign-up records which version a person accepted, so bump the constant whenever the meaning of a document changes
 * (not for a typo). The pages print the same date as "Last updated".
 */
export const TERMS_VERSION = "2026-11-16";
export const PRIVACY_VERSION = "2026-11-16";
export const PARENTS_NOTICE_VERSION = "2026-11-16";

export const LEGAL_VERSIONS = {
  terms: TERMS_VERSION,
  privacy: PRIVACY_VERSION,
  parents: PARENTS_NOTICE_VERSION,
} as const;

export type LegalDocument = keyof typeof LEGAL_VERSIONS;

/** "16 November 2026" for an ISO date, in English, independent of the server's locale. */
export function formatVersionDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const month = months[Number(m[2]) - 1];
  if (!month) return iso;
  return `${Number(m[3])} ${month} ${m[1]}`;
}

/** Public pages and their labels, in footer order. */
export const LEGAL_LINKS: readonly { href: string; label: string }[] = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/imprint", label: "Imprint" },
  { href: "/parents", label: "For parents" },
  { href: "/credits", label: "Credits" },
];
