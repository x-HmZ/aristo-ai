import type { Metadata } from "next";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { toLessonSource, type LessonSource, type SourceRow } from "@/lib/rag/credits";

// Public and static-friendly: rebuilt at most once an hour.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Credits | Aristo AI",
  description: "The reference material Aristo AI lessons are based on, with authors and licences.",
};

async function loadSources(): Promise<LessonSource[]> {
  try {
    const { data } = await createServiceClient()
      .from("reference_sources")
      .select("id, title, publisher, licence_id, licence_url, attribution_text")
      .eq("status", "ready")
      .order("title", { ascending: true });
    return ((data ?? []) as SourceRow[]).map(toLessonSource);
  } catch {
    return [];   // no database at build time: show the empty state
  }
}

const link = "underline decoration-dotted underline-offset-2 hover:text-ink";

export default async function CreditsPage() {
  const sources = await loadSources();
  return (
    <main className="min-h-screen bg-bg px-4 py-12 text-ink">
      <div className="mx-auto max-w-2xl space-y-10">
        <header className="space-y-2">
          <h1 className="type-h2 font-bold">Credits</h1>
          <p className="text-sm text-body">
            Aristo AI lessons are written by AI and grounded in the open material below. Lessons are rewritten and shortened; changes were made.
            The authors and publishers do not endorse Aristo AI.
          </p>
        </header>

        <section aria-labelledby="sources" className="space-y-4">
          <h2 id="sources" className="type-h3 font-bold">Reference material</h2>
          {sources.length === 0 ? (
            <p className="text-sm text-body">No reference material is credited yet.</p>
          ) : (
            <ul className="space-y-4">
              {sources.map((s) => (
                <li key={s.id} className="rounded-xl border border-line bg-surface p-4">
                  <p className="text-sm font-semibold text-ink">{s.title}</p>
                  <p className="text-sm text-body">{s.publisher}</p>
                  <p className="mt-1 text-sm text-body">
                    Licence:{" "}
                    {s.licenceUrl ? (
                      <a href={s.licenceUrl} target="_blank" rel="license noopener noreferrer" className={link}>{s.licenceName}</a>
                    ) : (
                      s.licenceName
                    )}
                  </p>
                  {s.attribution && <p className="mt-2 text-sm text-body">{s.attribution}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="assets" className="space-y-2">
          <h2 id="assets" className="type-h3 font-bold">Third-party assets</h2>
          <p className="text-sm text-body">
            Teacher models, fonts and other third-party assets used by the app are listed with their authors and licences in the
            LICENSES.md file of the project repository. A full list will be shown on this page.
          </p>
        </section>

        <p className="text-sm text-muted"><Link href="/" className={link}>Back to Aristo AI</Link></p>
      </div>
    </main>
  );
}
