import type { Metadata } from "next";

/**
 * Metadata for a legal page. A page that is still a draft is `noindex` so search engines do not publish text that is
 * not in force; once the operator's details are configured it becomes indexable.
 */
export function legalMetadata(title: string, description: string, inForce: boolean, path: string): Metadata {
  return {
    title: `${title} | Aristo`,
    description,
    alternates: { canonical: path },
    robots: inForce ? { index: true, follow: true } : { index: false, follow: false },
  };
}
