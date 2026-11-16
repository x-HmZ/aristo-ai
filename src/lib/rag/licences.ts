/**
 * Licences a reference source may carry, and whether the product may use
 * them. Fixed list in code: an admin picks from it, nobody types a licence.
 *
 *   allowed   - fine for a paid product, credit required (unless own material)
 *   warn      - allowed, but generated lessons may have to be shared alike
 *   refused   - never ingested, with the reason shown to the admin
 *
 * Not legal advice; see .claude/plans/launch/findings/content-plan.md.
 */

export type LicenceStatus = "allowed" | "warn" | "refused";

export interface Licence {
  id:           string;
  name:         string;
  status:       LicenceStatus;
  /** Canonical licence text URL, used as the default and shown on /credits. */
  url:          string | null;
  /** Own material needs no attribution text or licence URL. */
  needsCredit:  boolean;
  /** Shown to the admin for "warn" and "refused". */
  explanation?: string;
}

export const LICENCES: readonly Licence[] = [
  {
    id: "cc-by-4.0", name: "CC BY 4.0", status: "allowed", needsCredit: true,
    url: "https://creativecommons.org/licenses/by/4.0/",
  },
  {
    id: "cc0", name: "CC0 / public domain", status: "allowed", needsCredit: true,
    url: "https://creativecommons.org/publicdomain/zero/1.0/",
  },
  {
    id: "psf-2.0", name: "PSF License 2.0", status: "allowed", needsCredit: true,
    url: "https://docs.python.org/3/license.html",
  },
  {
    id: "mit", name: "MIT", status: "allowed", needsCredit: true,
    url: "https://opensource.org/license/mit",
  },
  {
    id: "own", name: "Own material (rights held)", status: "allowed", needsCredit: false,
    url: null,
  },
  {
    id: "cc-by-sa-4.0", name: "CC BY-SA 4.0", status: "warn", needsCredit: true,
    url: "https://creativecommons.org/licenses/by-sa/4.0/",
    explanation:
      "ShareAlike: lessons generated from this text may have to be released under the same licence. Only proceed if that is acceptable for this subject.",
  },
  {
    id: "cc-by-nc", name: "Any NC licence (BY-NC, BY-NC-SA, BY-NC-ND)", status: "refused", needsCredit: true,
    url: null,
    explanation:
      "NonCommercial licences forbid use in a paid product. This text cannot be ingested.",
  },
  {
    id: "cc-by-nd", name: "Any ND licence (BY-ND)", status: "refused", needsCredit: true,
    url: null,
    explanation:
      "NoDerivatives licences forbid adaptations, and turning chunks into lessons is an adaptation. This text cannot be ingested.",
  },
  {
    id: "unknown", name: "Unknown / not sure", status: "refused", needsCredit: true,
    url: null,
    explanation:
      "If the licence is not known, the text cannot be used. Find the licence, or get written permission and treat it as own material.",
  },
] as const;

export function getLicence(id: string): Licence | null {
  return LICENCES.find((l) => l.id === id) ?? null;
}

export interface LicenceCheckInput {
  licenceId:        string;
  licenceUrl?:      string | null;
  attributionText?: string | null;
}

export type LicenceCheck =
  | { ok: true;  status: "allowed" | "warn"; licence: Licence; warning?: string }
  | { ok: false; reason: string };

export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Decides whether a source with this licence and credit may be ingested. */
export function checkLicence(input: LicenceCheckInput): LicenceCheck {
  const licence = getLicence(input.licenceId);
  if (!licence) return { ok: false, reason: `Unknown licence id "${input.licenceId}".` };

  if (licence.status === "refused") {
    return { ok: false, reason: licence.explanation ?? "This licence is not allowed." };
  }

  if (licence.needsCredit) {
    if (!input.attributionText?.trim()) {
      return { ok: false, reason: "Attribution text is required for this licence." };
    }
    if (!isHttpUrl(input.licenceUrl ?? "")) {
      return { ok: false, reason: "A licence URL (http or https) is required for this licence." };
    }
  }

  return licence.status === "warn"
    ? { ok: true, status: "warn", licence, warning: licence.explanation }
    : { ok: true, status: "allowed", licence };
}
