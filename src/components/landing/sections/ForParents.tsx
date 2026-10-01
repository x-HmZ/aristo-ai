import { ListChecks, Mic, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { PARENTS_COPY } from "../content";
import { H2, LEDE, WRAP } from "../ui";

const MARKS = [ShieldCheck, ListChecks, Mic] as const;

/**
 * For Parents (V8.3b): the one place the page speaks to the adult, on the same system as every other section. The
 * heading column is the sections' own; the three promises are ink on a sheet of the product's paper (`.theme-paper`,
 * light in both themes, as the desk's quiz and It Remembers' card), ruled between entries. Nothing plays here.
 */
export function ForParents() {
  return (
    <section id="parents" aria-labelledby="parents-title" className="overflow-x-clip py-24">
      <div className={cn(WRAP, "grid items-start gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14")}>
        <div>
          <p className="mb-[18px] text-[13px] font-semibold uppercase tracking-[0.14em] text-muted">{PARENTS_COPY.eyebrow}</p>
          <h2 id="parents-title" className={H2}>{PARENTS_COPY.title}</h2>
          <p className={cn(LEDE, "mt-4")}>{PARENTS_COPY.line}</p>
        </div>
        <ul className="theme-paper rounded-[20px] border border-line bg-surface px-6 text-ink shadow-e2 sm:px-8">
          {PARENTS_COPY.promises.map((p, i) => {
            const Mark = MARKS[i];
            return (
              <li key={p.title} className="flex gap-4 border-line py-6 [&:not(:first-child)]:border-t">
                <Mark className="mt-0.5 size-5 shrink-0 text-accent-text" strokeWidth={2} aria-hidden />
                <div>
                  <h3 className="text-[17px] font-semibold leading-snug text-ink">{p.title}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-body">{p.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
