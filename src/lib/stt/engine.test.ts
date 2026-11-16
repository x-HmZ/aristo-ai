import { describe, expect, it } from "vitest";
import { selectSttEngine } from "@/lib/stt/engine";
import { audioExtension, estimateSeconds } from "@/lib/stt/audio";

const both  = { recorder: true,  browserSpeech: true };
const recOnly = { recorder: true, browserSpeech: false };
const none  = { recorder: false, browserSpeech: false };

describe("selectSttEngine", () => {
  it("defaults to the browser engine", () => {
    expect(selectSttEngine(undefined, both)).toBe("browser");
    expect(selectSttEngine("browser", both)).toBe("browser");
    expect(selectSttEngine("nonsense", both)).toBe("browser");
  });
  it("uses the server engine when asked and a recorder exists", () => {
    expect(selectSttEngine("server", both)).toBe("server");
    expect(selectSttEngine(" SERVER ", recOnly)).toBe("server");
  });
  it("degrades when capabilities are missing", () => {
    expect(selectSttEngine("server", { recorder: false, browserSpeech: true })).toBe("browser");
    expect(selectSttEngine("server", none)).toBe("none");
    expect(selectSttEngine("browser", recOnly)).toBe("none");
  });
});

describe("audio helpers", () => {
  it("maps recorder MIME types, ignoring codecs", () => {
    expect(audioExtension("audio/webm;codecs=opus")).toBe("webm");
    expect(audioExtension("audio/mp4")).toBe("mp4");
    expect(audioExtension("audio/ogg")).toBe("ogg");
    expect(audioExtension("audio/x-wav")).toBe("wav");
    expect(audioExtension("video/webm")).toBeNull();
    expect(audioExtension("")).toBeNull();
  });
  it("estimates at least one second", () => {
    expect(estimateSeconds(10)).toBe(1);
    expect(estimateSeconds(160_000)).toBe(10);
  });
});
