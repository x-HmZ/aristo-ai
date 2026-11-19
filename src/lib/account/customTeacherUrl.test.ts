import { describe, expect, it } from "vitest";
import { isAllowedCustomTeacherUrl } from "@/lib/account/customTeacherUrl";

describe("isAllowedCustomTeacherUrl", () => {
  it("accepts https Avaturn hosts", () => {
    expect(isAllowedCustomTeacherUrl("https://avaturn.me/a.glb", undefined)).toBe(true);
    expect(isAllowedCustomTeacherUrl("https://cdn.avaturn.me/a/b.glb", undefined)).toBe(true);
    expect(isAllowedCustomTeacherUrl("https://aristo.avaturn.dev/a.glb", "aristo")).toBe(true);
  });

  it("rejects other hosts, look-alikes, other tenants and odd URL forms", () => {
    for (const u of [
      "https://evil.example/a.glb",
      "https://avaturn.me.evil.example/a.glb",
      "https://notavaturn.me/a.glb",
      "https://other.avaturn.dev/a.glb",
      "http://avaturn.me/a.glb",
      "https://user:pw@avaturn.me/a.glb",
      "https://avaturn.me:8443/a.glb",
      "data:model/gltf-binary;base64,AAAA",
      "not a url",
    ]) {
      expect(isAllowedCustomTeacherUrl(u, "aristo"), u).toBe(false);
    }
    expect(isAllowedCustomTeacherUrl("https://aristo.avaturn.dev/a.glb", undefined)).toBe(false);
  });
});
