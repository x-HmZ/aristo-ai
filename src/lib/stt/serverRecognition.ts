/**
 * A SpeechRecognitionInstance backed by MediaRecorder and POST /api/stt, so the two voice-input
 * components can drive it exactly like the browser engine (start, stop, abort, onresult, onerror,
 * onend). Press start, press stop: the recording is then uploaded and one final result delivered.
 *
 * - Hard stop at MAX_RECORD_SECONDS.
 * - The microphone tracks are always released, on every path.
 * - Audio and text are never kept or logged on the client either.
 * - On any failure the instance reports an error and, when the browser engine exists, hands every
 *   later start() to it, so voice input keeps working where it can.
 */
import type {
  SpeechRecognitionEvent,
  SpeechRecognitionErrorEvent,
  SpeechRecognitionInstance,
} from "@/lib/speech";
import { MAX_RECORD_SECONDS, RECORD_BITS_PER_SECOND } from "./audio";

export type RecognitionState = "idle" | "recording" | "transcribing";

const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

function pickMime(): string | undefined {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return undefined;
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m));
}

function errorEvent(error: string): SpeechRecognitionErrorEvent {
  return Object.assign(new Event("error"), { error }) as SpeechRecognitionErrorEvent;
}

export class ServerRecognition extends EventTarget implements SpeechRecognitionInstance {
  lang = "en-US";
  continuous = false;
  interimResults = false;
  engine: "browser" | "server" = "server";

  onresult: ((e: SpeechRecognitionEvent) => void) | null = null;
  onerror:  ((e: SpeechRecognitionErrorEvent) => void) | null = null;
  onend:    ((e: Event) => void) | null = null;
  onstatechange: ((s: RecognitionState) => void) | null = null;

  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private aborted = false;
  /** Bumped by every start/abort so a late getUserMedia or upload cannot act for a stale session. */
  private session = 0;
  private delegate: SpeechRecognitionInstance | null = null;

  constructor(private readonly browserCtor: (new () => SpeechRecognitionInstance) | undefined) {
    super();
  }

  start(): void {
    if (this.delegate) { this.delegate.lang = this.lang; this.delegate.start(); return; }
    if (this.recorder) return; // already recording
    const session = ++this.session;
    this.aborted = false;
    this.setState("recording");

    navigator.mediaDevices.getUserMedia({ audio: true }).then(
      (stream) => {
        // Aborted (or restarted) while the permission prompt was open: release immediately.
        if (session !== this.session) { stream.getTracks().forEach((t) => t.stop()); return; }
        this.stream = stream;
        this.chunks = [];
        const mime = pickMime();
        const rec = new MediaRecorder(stream, {
          audioBitsPerSecond: RECORD_BITS_PER_SECOND,
          ...(mime ? { mimeType: mime } : {}),
        });
        this.recorder = rec;
        rec.ondataavailable = (e) => { if (e.data.size > 0) this.chunks.push(e.data); };
        rec.onstop = () => { void this.finish(session, rec.mimeType || mime || "audio/webm"); };
        rec.onerror = () => this.fail(session, "mic-error");
        rec.start();
        this.timer = setTimeout(() => this.stop(), MAX_RECORD_SECONDS * 1000);
      },
      (err: unknown) => {
        const denied = err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "SecurityError");
        this.fail(session, denied ? "not-allowed" : "mic-error", false);
      },
    );
  }

  /** Stop recording and transcribe what was captured. */
  stop(): void {
    if (this.delegate) { this.delegate.stop(); return; }
    this.clearTimer();
    if (this.recorder && this.recorder.state !== "inactive") this.recorder.stop();
    else this.abort();
  }

  /** Stop and throw the recording away. */
  abort(): void {
    if (this.delegate) { this.delegate.abort(); return; }
    this.aborted = true;
    this.session++;
    this.clearTimer();
    const rec = this.recorder;
    if (rec) { rec.ondataavailable = null; rec.onstop = null; rec.onerror = null; }
    if (rec && rec.state !== "inactive") { try { rec.stop(); } catch { /* ignore */ } }
    this.release();
    this.chunks = [];
    this.setState("idle");
  }

  private async finish(session: number, mime: string): Promise<void> {
    const chunks = this.chunks;
    this.chunks = [];
    this.release();
    if (session !== this.session || this.aborted) return;
    if (chunks.length === 0) { this.fail(session, "no-speech", false); return; }

    this.setState("transcribing");
    try {
      const form = new FormData();
      form.set("audio", new Blob(chunks, { type: mime.split(";")[0] || "audio/webm" }), "recording");
      const lang = this.lang.slice(0, 2).toLowerCase();
      if (/^[a-z]{2}$/.test(lang)) form.set("language", lang);

      const res = await fetch("/api/stt", { method: "POST", body: form });
      if (!res.ok) throw new Error(`stt ${res.status}`);
      const data = await res.json();
      if (session !== this.session) return;
      const text = typeof data?.text === "string" ? data.text.trim() : "";
      if (!text) { this.fail(session, "no-speech", false); return; }

      this.onresult?.({ results: { length: 1, 0: { isFinal: true, 0: { transcript: text } } } } as unknown as SpeechRecognitionEvent);
      this.setState("idle");
      this.onend?.(new Event("end"));
    } catch {
      this.fail(session, "stt-failed", true);
    }
  }

  /** Report an error then end. `switchEngine`: route future starts to the browser engine when it exists. */
  private fail(session: number, error: string, switchEngine = false): void {
    if (session !== this.session) return;
    this.clearTimer();
    this.release();
    this.setState("idle");
    if (switchEngine && this.browserCtor) this.adoptBrowserEngine();
    this.onerror?.(errorEvent(error));
    this.onend?.(new Event("end"));
  }

  private adoptBrowserEngine(): void {
    if (!this.browserCtor) return;
    const d = new this.browserCtor();
    d.lang = this.lang;
    d.continuous = this.continuous;
    d.interimResults = this.interimResults;
    d.onresult = (e) => this.onresult?.(e);
    d.onerror  = (e) => this.onerror?.(e);
    d.onend    = (e) => this.onend?.(e);
    this.delegate = d;
    this.engine = "browser";
  }

  private release(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.recorder = null;
  }

  private clearTimer(): void {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
  }

  private setState(s: RecognitionState): void {
    this.onstatechange?.(s);
  }
}
