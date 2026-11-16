import { describe, expect, it } from "vitest";
import { capabilitiesFor, capabilityAllowed, NO_CAPABILITIES } from "./capabilities";

describe("capabilitiesFor", () => {
  it("gives a missing profile nothing", () => {
    expect(capabilitiesFor(null)).toEqual(NO_CAPABILITIES);
    expect(capabilitiesFor(undefined)).toEqual(NO_CAPABILITIES);
  });

  it("follows the three switches", () => {
    expect(
      capabilitiesFor({ account_holder: "guardian", allow_voice_input: false, allow_free_chat: true, allow_custom_teacher: false }),
    ).toEqual({ voiceInput: false, freeChat: true, customTeacher: false });
    expect(
      capabilitiesFor({ account_holder: "self", allow_voice_input: true, allow_free_chat: true, allow_custom_teacher: true }),
    ).toEqual({ voiceInput: true, freeChat: true, customTeacher: true });
  });

  it("falls back to the old behaviour for a self-held account when the columns are missing", () => {
    expect(capabilitiesFor({})).toEqual({ voiceInput: true, freeChat: true, customTeacher: true });
    expect(capabilitiesFor({ account_holder: "self", allow_voice_input: null })).toMatchObject({ voiceInput: true });
  });

  it("falls back to off for a guardian-held account when a value is missing", () => {
    expect(capabilitiesFor({ account_holder: "guardian" })).toEqual(NO_CAPABILITIES);
  });

  it("answers one capability", () => {
    expect(capabilityAllowed({ account_holder: "guardian", allow_free_chat: false }, "freeChat")).toBe(false);
    expect(capabilityAllowed({ account_holder: "guardian", allow_free_chat: true }, "freeChat")).toBe(true);
  });
});
