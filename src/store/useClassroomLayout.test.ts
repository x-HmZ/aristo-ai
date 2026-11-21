import { describe, expect, it } from "vitest";
import { layoutModeOf } from "./useClassroomLayout";

describe("layoutModeOf", () => {
  it.each([
    [1440, 900, "desk"], [1280, 720, "desk"], [1024, 768, "desk"], [1180, 820, "desk"], [1024, 1366, "desk"],
    [768, 1024, "portrait"], [820, 1180, "portrait"],
    [390, 844, "portrait"], [360, 780, "portrait"], [320, 568, "portrait"],
    [844, 390, "landscape"], [667, 375, "landscape"], [932, 430, "landscape"],
  ])("%i x %i is %s", (w, h, mode) => {
    expect(layoutModeOf(w, h)).toBe(mode);
  });
});
