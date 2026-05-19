/**
 * Wrapped Anthropic client with usage logging.
 *
 * Use this instead of `new Anthropic(...)` anywhere in `src/lib/agents/*`
 * and `src/app/api/**` so every messages.create() call records to
 * `usage_events`. Preserves the original SDK signature — refactor is
 * mechanical.
 *
 * Usage:
 *   const client = getAnthropic();
 *   const res = await client.messages.create(
 *     { model: MODELS.teaching, … },
 *     { feature: "teach.lesson", userId: "uuid" }   // <-- 2nd arg is the
 *                                                   //     usage tag (optional)
 *   );
 */

import Anthropic from "@anthropic-ai/sdk";
import { logUsage } from "./usage";
import { anthropicCostMicros } from "./pricing";

export interface UsageTag {
  /** Dot-namespaced feature, e.g. "teach.lesson", "quiz.generate". */
  feature: string;
  /** Optional learner id for per-user cost reporting. */
  userId?: string | null;
  /** Optional extra metadata stored on the usage row. */
  metadata?: Record<string, unknown>;
}

type MessageCreateParams = Parameters<Anthropic["messages"]["create"]>[0];
type MessageCreateOptions = Parameters<Anthropic["messages"]["create"]>[1];

interface WrappedAnthropic {
  messages: {
    create: (
      params:    MessageCreateParams,
      tag?:      UsageTag,
      options?:  MessageCreateOptions,
    ) => Promise<Anthropic.Messages.Message>;
  };
  /** Escape hatch when streaming or beta endpoints are needed. */
  raw: Anthropic;
}

let _client: Anthropic | null = null;
function getRaw(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

export function getAnthropic(): WrappedAnthropic {
  const raw = getRaw();
  return {
    raw,
    messages: {
      create: async (params, tag, options) => {
        // `params.stream` would force a stream; we only wrap non-stream here.
        const result = (await raw.messages.create(params, options)) as Anthropic.Messages.Message;
        try {
          const usage = result.usage;
          if (usage && tag) {
            logUsage({
              user_id:               tag.userId ?? null,
              provider:              "anthropic",
              model:                 result.model ?? String(params.model),
              feature:               tag.feature,
              input_tokens:          usage.input_tokens,
              output_tokens:         usage.output_tokens,
              cache_read_tokens:     usage.cache_read_input_tokens ?? null,
              cache_creation_tokens: usage.cache_creation_input_tokens ?? null,
              cost_usd_micros:       anthropicCostMicros({
                model:                 result.model ?? String(params.model),
                input_tokens:          usage.input_tokens,
                output_tokens:         usage.output_tokens,
                cache_read_tokens:     usage.cache_read_input_tokens ?? 0,
                cache_creation_tokens: usage.cache_creation_input_tokens ?? 0,
              }),
              metadata: tag.metadata,
            });
          }
        } catch (err) {
          console.error("[anthropic] usage logging failed (non-fatal)", err);
        }
        return result;
      },
    },
  };
}
