"use client";

import { useEffect } from "react";

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

/**
 * Cloudflare Turnstile. Renders nothing and loads nothing without a site key: the page passes `siteKey` only when
 * both NEXT_PUBLIC_TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY are set. The widget adds a hidden field named
 * cf-turnstile-response to the surrounding form, which the sign-up action verifies.
 */
export function TurnstileWidget({ siteKey }: { siteKey?: string }) {
  useEffect(() => {
    if (!siteKey) return;
    if (document.querySelector(`script[src="${SCRIPT_SRC}"]`)) return;
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }, [siteKey]);

  if (!siteKey) return null;
  return <div className="cf-turnstile min-h-[65px]" data-sitekey={siteKey} aria-label="Security check" />;
}
