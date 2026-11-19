/**
 * Child-safe defaults: which optional features a profile may use.
 *
 *   voiceInput     the microphone (the browser's speech service, or /api/stt)
 *   freeChat       "Explore freely": the learner's own typed topics go to the AI
 *   customTeacher  the selfie-made teacher (a third-party avatar service)
 *
 * The three booleans live on profiles (migration 025). A guardian-held account starts with all three off and the
 * guardian turns each on in /account. A self-held 16+ account has them on. A missing profile gets nothing.
 * If a column is missing because migration 025 is not applied yet, the old behaviour holds for a self-held
 * account (on) and the safe one for a guardian-held account (off).
 */

export interface CapabilityProfile {
  account_holder?: string | null;
  allow_voice_input?: boolean | null;
  allow_free_chat?: boolean | null;
  allow_custom_teacher?: boolean | null;
}

export interface Capabilities {
  voiceInput: boolean;
  freeChat: boolean;
  customTeacher: boolean;
}

export type CapabilityKey = keyof Capabilities;

export const NO_CAPABILITIES: Capabilities = { voiceInput: false, freeChat: false, customTeacher: false };
export const ALL_CAPABILITIES: Capabilities = { voiceInput: true, freeChat: true, customTeacher: true };

/** Profile column behind each capability, for the select list and the parent controls. */
export const CAPABILITY_COLUMNS: Record<CapabilityKey, "allow_voice_input" | "allow_free_chat" | "allow_custom_teacher"> = {
  voiceInput: "allow_voice_input",
  freeChat: "allow_free_chat",
  customTeacher: "allow_custom_teacher",
};

export function capabilitiesFor(profile: CapabilityProfile | null | undefined): Capabilities {
  if (!profile) return NO_CAPABILITIES;
  const guardian = profile.account_holder === "guardian";
  const pick = (value: boolean | null | undefined) => (typeof value === "boolean" ? value : !guardian);
  return {
    voiceInput: pick(profile.allow_voice_input),
    freeChat: pick(profile.allow_free_chat),
    customTeacher: pick(profile.allow_custom_teacher),
  };
}

export function capabilityAllowed(profile: CapabilityProfile | null | undefined, key: CapabilityKey): boolean {
  return capabilitiesFor(profile)[key];
}
