import type { GetStaticProps } from "next";

/**
 * Dev harness pages (`pages/dev/*`) are open to anyone who can reach the URL, so a production
 * build answers them with a real 404. They stay usable under `next dev`, and a production build
 * made with NEXT_PUBLIC_DEV_PAGES=true keeps them (for the capture scripts).
 */
export const devPagesEnabled = (): boolean =>
  process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_DEV_PAGES === "true";

export const getDevPageStaticProps: GetStaticProps = async () =>
  devPagesEnabled() ? { props: {} } : { notFound: true };
