import { describe, expect, it } from "vitest";
import { aiFirstLessonNotice, aiTeacherStatement, disclosureName } from "./aiDisclosure";
import { LEGAL_LINKS, LEGAL_VERSIONS, PRIVACY_VERSION, TERMS_VERSION, formatVersionDate } from "./documents";
import { reportProblemHref, resolveOperator } from "./operator";

describe("operator configuration", () => {
  it("is complete when name, town and contact email are set", () => {
    const op = resolveOperator({
      NEXT_PUBLIC_OPERATOR_NAME: "Test Person",
      NEXT_PUBLIC_OPERATOR_TOWN: "Graz",
      NEXT_PUBLIC_CONTACT_EMAIL: "hello@example.test",
    });
    expect(op.complete).toBe(true);
    expect(op.missing).toEqual([]);
    expect(op.country).toBe("Austria");
    expect(op.imprintComplete).toBe(false);
    expect(op.missingForImprint).toEqual(["NEXT_PUBLIC_OPERATOR_ADDRESS"]);
  });

  it("is imprint-complete with a postal address, and honours the country", () => {
    const op = resolveOperator({
      NEXT_PUBLIC_OPERATOR_NAME: "Test Person",
      NEXT_PUBLIC_OPERATOR_TOWN: "Graz",
      NEXT_PUBLIC_OPERATOR_COUNTRY: "Germany",
      NEXT_PUBLIC_CONTACT_EMAIL: "hello@example.test",
      NEXT_PUBLIC_OPERATOR_ADDRESS: "Teststrasse 1, 8010 Graz",
    });
    expect(op.imprintComplete).toBe(true);
    expect(op.country).toBe("Germany");
  });

  it("lists what is missing and invents nothing", () => {
    const op = resolveOperator({});
    expect(op.complete).toBe(false);
    expect(op.name).toBeNull();
    expect(op.email).toBeNull();
    expect(op.missing).toEqual([
      "NEXT_PUBLIC_OPERATOR_NAME",
      "NEXT_PUBLIC_OPERATOR_TOWN",
      "NEXT_PUBLIC_CONTACT_EMAIL",
    ]);
  });

  it("treats blank and malformed values as unset", () => {
    const op = resolveOperator({
      NEXT_PUBLIC_OPERATOR_NAME: "   ",
      NEXT_PUBLIC_OPERATOR_TOWN: "Graz",
      NEXT_PUBLIC_CONTACT_EMAIL: "not an email",
    });
    expect(op.name).toBeNull();
    expect(op.email).toBeNull();
    expect(op.complete).toBe(false);
  });

  it("builds the report-a-problem link only when a contact address is set", () => {
    expect(reportProblemHref(resolveOperator({}))).toBeNull();
    const href = reportProblemHref(resolveOperator({ NEXT_PUBLIC_CONTACT_EMAIL: "hello@example.test" }));
    expect(href?.startsWith("mailto:hello@example.test?subject=")).toBe(true);
  });
});

describe("legal document versions", () => {
  it("exports a dated version for terms and privacy", () => {
    expect(TERMS_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(PRIVACY_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(LEGAL_VERSIONS.terms).toBe(TERMS_VERSION);
    expect(LEGAL_VERSIONS.privacy).toBe(PRIVACY_VERSION);
  });

  it("formats an ISO date and leaves anything else alone", () => {
    expect(formatVersionDate("2026-11-16")).toBe("16 November 2026");
    expect(formatVersionDate("soon")).toBe("soon");
  });

  it("links the four legal pages and the credits from the footer", () => {
    expect(LEGAL_LINKS.map((l) => l.href)).toEqual(["/privacy", "/terms", "/imprint", "/parents", "/credits"]);
  });
});

describe("AI disclosure wording", () => {
  it("names the active teacher and falls back to a neutral word", () => {
    expect(aiTeacherStatement("Jake")).toBe("Jake is an AI teacher and can make mistakes.");
    expect(disclosureName("MJ")).toBe("MJ");
    expect(disclosureName(undefined)).toBe("Your teacher");
    expect(aiFirstLessonNotice("Jake")).toContain("Jake is an AI teacher and can make mistakes.");
  });
});
