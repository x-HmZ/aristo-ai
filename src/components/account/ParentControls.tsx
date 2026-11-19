import { saveParentControls } from "@/app/account/actions";
import { Button } from "@/components/ui/button";
import type { Capabilities } from "@/lib/account/capabilities";

interface Switch {
  name: string;
  key: keyof Capabilities;
  label: string;
  text: string;
}

// One plain sentence each: what it does and what data goes where. Keep in step with the privacy notice.
const SWITCHES: Switch[] = [
  {
    name: "voice",
    key: "voiceInput",
    label: "Voice input",
    text: "Lets the learner speak answers. The audio is sent from the browser to its speech service (Google in Chrome, as named in the privacy notice) and we receive only the text.",
  },
  {
    name: "chat",
    key: "freeChat",
    label: "Free chat",
    text: "Lets the learner type their own topics and questions. What they type is sent to our AI provider (Anthropic) to write the answer, without their name.",
  },
  {
    name: "teacher",
    key: "customTeacher",
    label: "Custom teacher",
    text: "Lets the learner build a teacher avatar from a selfie. The photos are processed by the avatar service (Avaturn), which is a separate company.",
  },
];

/** Shown only for a guardian-held account. A plain form: the switches are saved by a server action. */
export function ParentControls({ capabilities }: { capabilities: Capabilities }) {
  return (
    <section aria-labelledby="parent-heading" className="rounded-2xl border border-line bg-surface p-6 space-y-4">
      <div>
        <h2 id="parent-heading" className="type-h3 font-semibold">Parent controls</h2>
        <p className="text-sm text-muted">All three are off until you turn them on. You can change them at any time.</p>
      </div>
      <form action={saveParentControls} className="space-y-3">
        {SWITCHES.map((s) => (
          <label key={s.name} className="flex cursor-pointer items-start gap-3 rounded-[10px] border border-line p-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent-text">
            <input type="checkbox" name={s.name} defaultChecked={capabilities[s.key]} className="mt-0.5 size-5 shrink-0 accent-accent" />
            <span className="text-sm">
              <span className="block font-semibold text-ink">{s.label}</span>
              <span className="block text-body">{s.text}</span>
            </span>
          </label>
        ))}
        <Button type="submit">Save settings</Button>
      </form>
    </section>
  );
}
