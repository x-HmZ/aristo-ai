import { ListChecks, Mic, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { PARENTS_COPY } from "../content";
import { H2, WRAP } from "../ui";

const MARKS = [ShieldCheck, ListChecks, Mic] as const;

/**
 * For Parents (V8.3b): the one place the page turns from the student to the adult, so it is the one band in the page's
 * warm wash (`bg-tint`, the token for one surface per section; plan note 5), edge to edge, in both themes. Across the
 * top the eyebrow, the heading and what Aristo is; under it the three promises side by side, each opening on a
 * hairline, read like the facts on a school letter rather than a feature grid. Nothing plays here.
 */
export function ForParents() {
  return (
    <section id="parents" aria-labelledby="parents-title" className="border-y border-tint-line bg-tint py-20 lg:py-24">
      <div className={WRAP}>
        <div className="grid items-end gap-6 lg:grid-cols-[minmax(0,6fr)_minmax(0,6fr)] lg:gap-14">
          <div>
            <p className="mb-[18px] text-[13px] font-semibold uppercase tracking-[0.14em] text-accent-text">{PARENTS_COPY.eyebrow}</p>
            <h2 id="parents-title" className={H2}>{PARENTS_COPY.title}</h2>
          </div>
          <p className="max-w-[34rem] text-[17px] leading-relaxed text-body lg:pb-1">{PARENTS_COPY.line}</p>
        </div>
        <ul className="mt-12 grid gap-x-10 gap-y-8 md:grid-cols-3 lg:mt-14 lg:gap-x-14">
          {PARENTS_COPY.promises.map((p, i) => {
            const Mark = MARKS[i];
            return (
              <li key={p.title} className="border-t border-tint-line pt-6">
                <h3 className="flex items-start gap-2.5 text-[17px] font-semibold leading-snug text-ink">
                  <Mark className={cn("mt-[3px] size-[18px] shrink-0 text-accent-text")} strokeWidth={2} aria-hidden />
                  {p.title}
                </h3>
                <p className="mt-2.5 text-[15px] leading-relaxed text-body">{p.body}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
