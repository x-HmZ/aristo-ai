/**
 * The one place the speech-to-text model id lives (kept out of agents/models.ts, which is for
 * Anthropic ids). Its price row is OPENAI_TRANSCRIBE_PER_MINUTE in src/lib/llm/pricing.ts.
 */
export const STT_MODEL = "gpt-4o-mini-transcribe";
