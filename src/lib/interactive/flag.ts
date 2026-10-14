/**
 * Interactive visuals are OFF until NEXT_PUBLIC_INTERACTIVE_VISUALS is "true" (V10).
 *
 * It gates what costs money and shows generated code: the teaching agents are only
 * offered the option, and /api/learn/interactive only answers, when it is on. It is
 * also the feature-wide kill switch (flip it and redeploy): a lesson already holding a
 * spec simply gets no widget and carries on over its image. The client never reads it;
 * with no spec in a lesson there is nothing to fetch.
 */
export const INTERACTIVE_VISUALS_ENABLED = process.env.NEXT_PUBLIC_INTERACTIVE_VISUALS === "true";
