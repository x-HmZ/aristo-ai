"use client";

import { useEffect } from "react";
import { RETRY_BUTTON, StatusPage } from "@/components/system/StatusPage";

/** A page in the App Router threw while rendering: say so plainly and offer a retry and a way back. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app error]", error.digest ?? "", error.message);
  }, [error]);

  return (
    <StatusPage
      title="Something went wrong"
      message="This page could not be shown. Nothing you did caused it. Try again, or go back to the start."
      action={
        <button type="button" onClick={reset} className={RETRY_BUTTON}>
          Try again
        </button>
      }
    />
  );
}
