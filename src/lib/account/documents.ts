/**
 * The legal documents a user accepts, and the version string recorded with each acceptance.
 *
 * One place to change when a document changes: bump the version here AFTER the new text is live at the path.
 * The version is what lands in `consents.document_version`, so it must identify the exact text the user saw.
 * The pages themselves (/terms and /privacy) are built elsewhere; this module only names them.
 */

export const TERMS_PATH = "/terms";
export const PRIVACY_PATH = "/privacy";

export const TERMS_VERSION = "2026-11-16";
export const PRIVACY_VERSION = "2026-11-16";
/** The wording of the guardian declaration shown at sign-up (see GUARDIAN_DECLARATION_TEXT). */
export const GUARDIAN_DECLARATION_VERSION = "2026-11-16";

export const GUARDIAN_DECLARATION_TEXT =
  "I am the parent or legal guardian of the learner, and I am 18 or older.";

export type ConsentKind = "terms" | "privacy" | "guardian_declaration";

export interface ConsentRow {
  kind: ConsentKind;
  document_version: string;
}

/**
 * The consent rows recorded at sign-up. Terms and privacy for everyone; the guardian declaration only for an
 * account held on behalf of a learner under 16 (or any learner whose guardian created the account).
 */
export function consentRowsFor(holder: "self" | "guardian"): ConsentRow[] {
  const rows: ConsentRow[] = [
    { kind: "terms", document_version: TERMS_VERSION },
    { kind: "privacy", document_version: PRIVACY_VERSION },
  ];
  if (holder === "guardian") {
    rows.push({ kind: "guardian_declaration", document_version: GUARDIAN_DECLARATION_VERSION });
  }
  return rows;
}

/** The kinds a user must have on record before lessons open (ACCESS_MODE=open). Any version counts. */
export function requiredConsentKinds(holder: "self" | "guardian"): ConsentKind[] {
  return consentRowsFor(holder).map((r) => r.kind);
}
