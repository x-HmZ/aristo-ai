import type { ReactNode } from "react";
import { AristoMark } from "@/components/brand/AristoMark";

/** The page frame the sign-in and sign-up pages share: brand, a card, a heading. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bg text-ink flex items-center justify-center p-4">
      <main className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <p className="mb-3 flex justify-center">
            <AristoMark decorative={false} className="h-6 text-ink" litClassName="text-accent" />
          </p>
          <p className="text-body">Your personal AI teacher</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-8 shadow-e1">
          <h1 className="type-h2 font-semibold text-ink mb-1">{title}</h1>
          {subtitle && <p className="text-muted text-sm mb-6">{subtitle}</p>}
          {children}
        </div>
      </main>
    </div>
  );
}

/** An error the user can fix, announced to screen readers when it appears. */
export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div role="alert" className="mb-4 p-3 rounded-[10px] bg-danger/10 border border-danger/25 text-danger text-sm">
      {message}
    </div>
  );
}

/** A neutral notice (not an error). */
export function FormNotice({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div role="status" className="mb-4 p-3 rounded-[10px] bg-tint border border-tint-line text-ink text-sm">
      {message}
    </div>
  );
}

/** A radio option with a 44 px target. */
export function RadioOption({ name, value, label, required }: { name: string; value: string; label: string; required?: boolean }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[10px] border border-line bg-surface px-3.5 text-sm text-ink hover:border-muted/50 has-[:checked]:border-accent-text has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent-text">
      <input type="radio" name={name} value={value} required={required} className="size-4 accent-accent" />
      <span>{label}</span>
    </label>
  );
}

/** A checkbox with its label as the 44 px target. Children are the label content (links allowed). */
export function CheckOption({ name, children }: { name: string; children: ReactNode }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 py-2 text-sm text-ink">
      <input type="checkbox" name={name} required className="mt-0.5 size-5 shrink-0 accent-accent" />
      <span>{children}</span>
    </label>
  );
}

export const SELECT_CLASS =
  "flex h-11 w-full rounded-[10px] border border-line bg-surface px-3.5 py-2 text-base text-ink hover:border-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-text focus-visible:ring-offset-2 md:text-sm";

export const LINK_CLASS = "text-accent-text font-semibold underline-offset-4 hover:underline";
