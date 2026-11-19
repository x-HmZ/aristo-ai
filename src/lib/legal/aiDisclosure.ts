/**
 * The words of the "this teacher is an AI" disclosure (EU AI Act Art 50(1); the AI provider's own terms for products
 * children use). One place, so the persistent label, the first-lesson notice and the tests agree.
 */

/** What to call the active teacher: their name, or a neutral word for the custom teacher or an unknown value. */
export function disclosureName(label: string | null | undefined): string {
  const t = label?.trim();
  return t ? t : "Your teacher";
}

/** The persistent label next to the teacher. */
export function aiTeacherStatement(name: string): string {
  return `${name} is an AI teacher and can make mistakes.`;
}

/** The one-time notice shown before the first lesson. */
export function aiFirstLessonNotice(name: string): string {
  return `${aiTeacherStatement(name)} It is a computer program, not a person. Check anything important, and do not type your full name, address or phone number.`;
}

/** localStorage key remembering that the first-lesson notice was dismissed on this device. */
export const AI_NOTICE_STORAGE_KEY = "aristo-ai-notice-seen";
