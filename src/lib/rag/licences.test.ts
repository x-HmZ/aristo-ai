import { describe, expect, it } from "vitest";
import { checkLicence, getLicence, LICENCES } from "./licences";
import { contentHashOf, createSourceSchema, findDuplicate, normaliseForHash } from "./sources";

const credit = { attributionText: "Based on X, licensed CC BY 4.0", licenceUrl: "https://creativecommons.org/licenses/by/4.0/" };

describe("licence allow-list", () => {
  it("allows the paid-product licences when credit is complete", () => {
    for (const id of ["cc-by-4.0", "cc0", "psf-2.0", "mit"]) {
      const r = checkLicence({ licenceId: id, ...credit });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.status).toBe("allowed");
    }
  });

  it("needs no credit for own material", () => {
    const r = checkLicence({ licenceId: "own" });
    expect(r.ok).toBe(true);
  });

  it("allows CC BY-SA with a visible warning", () => {
    const r = checkLicence({ licenceId: "cc-by-sa-4.0", ...credit });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.status).toBe("warn");
      expect(r.warning).toMatch(/shared|released|licence/i);
    }
  });

  it("refuses NC, ND and unknown with an explanation", () => {
    for (const id of ["cc-by-nc", "cc-by-nd", "unknown"]) {
      const r = checkLicence({ licenceId: id, ...credit });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason.length).toBeGreaterThan(20);
    }
  });

  it("requires attribution text and a licence URL except for own material", () => {
    expect(checkLicence({ licenceId: "cc-by-4.0", licenceUrl: credit.licenceUrl }).ok).toBe(false);
    expect(checkLicence({ licenceId: "cc-by-4.0", attributionText: "x" }).ok).toBe(false);
    expect(checkLicence({ licenceId: "cc-by-4.0", attributionText: "x", licenceUrl: "ftp://x" }).ok).toBe(false);
  });

  it("rejects an id that is not on the list", () => {
    expect(checkLicence({ licenceId: "gpl-9" }).ok).toBe(false);
    expect(getLicence("mit")?.name).toBe("MIT");
    expect(new Set(LICENCES.map((l) => l.id)).size).toBe(LICENCES.length);
  });
});

describe("duplicate detection", () => {
  it("normalises whitespace before hashing", async () => {
    expect(normaliseForHash("a  b\n\nc ")).toBe("a b c");
    expect(await contentHashOf("a  b\n\nc ")).toBe(await contentHashOf("a b c"));
    expect(await contentHashOf("a b c")).not.toBe(await contentHashOf("a b d"));
    expect(await contentHashOf("abc")).toMatch(/^[a-f0-9]{64}$/);
  });

  it("refuses a hash already held by a live source but not a failed one", () => {
    const rows = [
      { id: "1", title: "Old", status: "ready", content_hash: "h1" },
      { id: "2", title: "Broken", status: "failed", content_hash: "h2" },
    ];
    expect(findDuplicate("h1", rows)?.id).toBe("1");
    expect(findDuplicate("h2", rows)).toBeNull();
    expect(findDuplicate("h3", rows)).toBeNull();
  });
});

describe("createSourceSchema", () => {
  const base = {
    title: "IM 6-8", publisher: "Illustrative Mathematics", licenceId: "cc-by-4.0",
    licenceUrl: credit.licenceUrl, attributionText: credit.attributionText,
    domain: "math_grade_7", contentHash: "a".repeat(64), batchCount: 12,
  };

  it("accepts a valid body and defaults dryRun", () => {
    const r = createSourceSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.dryRun).toBe(false);
  });

  it("rejects a bad domain, hash and grade range", () => {
    expect(createSourceSchema.safeParse({ ...base, domain: "Math 7" }).success).toBe(false);
    expect(createSourceSchema.safeParse({ ...base, contentHash: "zz" }).success).toBe(false);
    expect(createSourceSchema.safeParse({ ...base, gradeMin: 8, gradeMax: 6 }).success).toBe(false);
  });
});
