/**
 * Fire-and-forget usage logging.
 *
 * Every wrapped LLM/embedding/media call records to public.usage_events
 * via the service-role client. Errors are swallowed so observability
 * cannot break the actual product flow.
 */

import { createServiceClient } from "@/lib/supabase/server";

export interface UsageEvent {
  user_id?:               string | null;
  /** "internal" is for zero-cost product signals (e.g. greeting_action_taken), not a provider API call. */
  provider:               "anthropic" | "openai" | "fal" | "internal";
  model:                  string;
  feature:                string;
  input_tokens?:          number | null;
  output_tokens?:         number | null;
  cache_read_tokens?:     number | null;
  cache_creation_tokens?: number | null;
  units?:                 number | null;
  cost_usd_micros:        number;
  metadata?:              Record<string, unknown>;
}

export function logUsage(event: UsageEvent): void {
  // Don't await — never block the caller. Failures land in the server console.
  void (async () => {
    try {
      const service = createServiceClient();
      await service.from("usage_events").insert({
        user_id:               event.user_id ?? null,
        provider:              event.provider,
        model:                 event.model,
        feature:               event.feature,
        input_tokens:          event.input_tokens          ?? null,
        output_tokens:         event.output_tokens         ?? null,
        cache_read_tokens:     event.cache_read_tokens     ?? null,
        cache_creation_tokens: event.cache_creation_tokens ?? null,
        units:                 event.units                  ?? null,
        cost_usd_micros:       event.cost_usd_micros,
        metadata:              event.metadata               ?? {},
      });
    } catch (err) {
      console.error("[usage] failed to record usage event", err);
    }
  })();
}
