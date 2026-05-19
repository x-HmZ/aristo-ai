/**
 * OpenAI embeddings — usage-logged wrapper.
 *
 * Used by `src/lib/rag/embed.ts` so every embedding call records to
 * `usage_events`. Preserves the underlying SDK semantics; on missing API
 * key it returns null (matches the existing graceful degradation).
 */

import OpenAI from "openai";
import { logUsage } from "./usage";
import { openaiCostMicros } from "./pricing";

const MODEL = "text-embedding-3-small";
const DIMS  = 1536;

let _client: OpenAI | null = null;

function getClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  _client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _client;
}

export interface EmbedTag {
  feature: string;        // "rag.embed.ingest" | "rag.embed.retrieve" | "rag.embed.test"
  userId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Returns a 1536-dim embedding for the supplied text, or null when the
 * API key is absent. The usage event is logged best-effort.
 */
export async function embedTextLogged(
  text: string,
  tag?: EmbedTag
): Promise<number[] | null> {
  const client = getClient();
  if (!client) return null;
  const input = text.slice(0, 8000);

  const res = await client.embeddings.create({ model: MODEL, input, dimensions: DIMS });
  const embedding = res.data[0]?.embedding ?? null;
  if (!embedding) return null;

  try {
    if (tag && res.usage?.prompt_tokens) {
      logUsage({
        user_id:         tag.userId ?? null,
        provider:        "openai",
        model:           MODEL,
        feature:         tag.feature,
        input_tokens:    res.usage.prompt_tokens,
        cost_usd_micros: openaiCostMicros({
          model:        MODEL,
          input_tokens: res.usage.prompt_tokens,
        }),
        metadata: tag.metadata,
      });
    }
  } catch (err) {
    console.error("[openai] usage logging failed (non-fatal)", err);
  }

  return embedding;
}

export { MODEL as EMBEDDING_MODEL, DIMS as EMBEDDING_DIMS };
