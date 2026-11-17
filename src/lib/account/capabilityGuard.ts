/**
 * Server-side check for the child-safety switches. Routes behind a switch call this after authenticating:
 *
 *   const off = await refuseUnlessAllowed(user.id, "voiceInput");
 *   if (off) return off;
 *
 * It answers 403 with a short message when the guardian has not turned the feature on. Server only.
 */

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { capabilityAllowed, type CapabilityKey } from "./capabilities";

const MESSAGES: Record<CapabilityKey, string> = {
  voiceInput: "Voice input is turned off for this account. A parent or guardian can turn it on in Account.",
  freeChat: "Free chat is turned off for this account. A parent or guardian can turn it on in Account.",
  customTeacher: "The custom teacher is turned off for this account. A parent or guardian can turn it on in Account.",
};

export async function isCapabilityAllowed(userId: string, key: CapabilityKey): Promise<boolean> {
  const { data } = await createServiceClient().from("profiles").select("*").eq("id", userId).maybeSingle();
  return capabilityAllowed(data, key);
}

/** null when allowed; a 403 response when not (and when the profile cannot be read: fail closed). */
export async function refuseUnlessAllowed(userId: string, key: CapabilityKey): Promise<NextResponse | null> {
  try {
    if (await isCapabilityAllowed(userId, key)) return null;
  } catch {
    // fall through: fail closed
  }
  return NextResponse.json({ error: MESSAGES[key], code: "capability_off" }, { status: 403 });
}
