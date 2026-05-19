/**
 * RAG Embed — Phase 8
 *
 * Generates a text embedding using OpenAI text-embedding-3-small (1536 dims).
 * This model is already available through the project's existing OPENAI_API_KEY.
 *
 * Returns null if the API key is missing so callers can degrade gracefully.
 */

import { embedTextLogged } from "@/lib/llm/openai";

/**
 * Returns a 1536-dimensional embedding for the given text,
 * or null if the API key is absent.
 *
 * Records to public.usage_events when a feature tag is supplied — the
 * default tag groups untagged callers under "rag.embed.unspecified" so
 * they still appear on the cost dashboard.
 */
export async function getEmbedding(
  text: string,
  feature: string = "rag.embed.unspecified"
): Promise<number[] | null> {
  return embedTextLogged(text, { feature });
}

/**
 * Splits a long text into overlapping chunks of roughly `chunkSize` characters.
 * Used by the ingest route to break reference documents into retrievable pieces.
 *
 * @param text      Full source text
 * @param chunkSize Target character count per chunk (~300-500 tokens at ~4 chars/token)
 * @param overlap   Characters to repeat at the start of each new chunk (context carry-over)
 */
export function chunkText(
  text:      string,
  chunkSize  = 1800,   // ~450 tokens
  overlap    = 200
): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end   = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end).trim();
    if (chunk.length > 50) chunks.push(chunk);   // skip tiny trailing fragments
    if (end >= text.length) break;
    start = end - overlap;
  }

  return chunks;
}
