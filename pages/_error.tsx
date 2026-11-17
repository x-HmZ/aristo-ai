import type { NextPageContext } from "next";
import { StatusPage } from "@/components/system/StatusPage";

/** The Pages Router's error screen (/learn, /demo, /dev/*): a reload is the retry, and home is the way back. */
function ErrorPage({ statusCode }: { statusCode?: number }) {
  return (
    <StatusPage
      title="Something went wrong"
      message={
        statusCode === 404
          ? "We could not find that page."
          : "This page could not be shown. Nothing you did caused it. Reload the page to try again, or go back to the start."
      }
      action={
        <a
          href=""
          className="inline-flex min-h-[44px] items-center justify-center rounded-[10px] bg-accent px-4 text-sm font-semibold text-accent-ink hover:bg-accent-hover"
        >
          Reload
        </a>
      }
    />
  );
}

ErrorPage.getInitialProps = ({ res, err }: NextPageContext) => ({
  statusCode: res?.statusCode ?? err?.statusCode ?? 500,
});

export default ErrorPage;
