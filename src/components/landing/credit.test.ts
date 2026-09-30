import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { JAKE_CREDIT } from "./credit";

// Vitest here has no JSX transform, so Teacher.tsx cannot be imported; its source text is checked instead.
const teacher = readFileSync(path.join(__dirname, "..", "three", "Teacher.tsx"), "utf8");

describe("JAKE_CREDIT", () => {
  it("matches the credit the classroom shows (AVATAR_ASSETS.jake.credit and CANINO3D in Teacher.tsx)", () => {
    const jake = teacher.slice(teacher.indexOf("  jake: {"), teacher.indexOf("  mj: {"));
    expect(jake).toContain(`title:     "${JAKE_CREDIT.title}"`);
    expect(jake).toContain(`sourceUrl: "${JAKE_CREDIT.sourceUrl}"`);
    expect(jake).toContain("...CANINO3D");
    const canino = teacher.slice(teacher.indexOf("const CANINO3D"), teacher.indexOf("const CANINO3D") + 400);
    expect(canino).toContain(`author:     "${JAKE_CREDIT.author}"`);
    expect(canino).toContain(`authorUrl:  "${JAKE_CREDIT.authorUrl}"`);
    expect(canino).toContain(`license:    "${JAKE_CREDIT.license}"`);
    expect(canino).toContain(`licenseUrl: "${JAKE_CREDIT.licenseUrl}"`);
    expect(canino).toContain(`modified:   ${JAKE_CREDIT.modified}`);
  });
});
