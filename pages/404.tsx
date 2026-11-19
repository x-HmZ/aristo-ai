import { StatusPage } from "@/components/system/StatusPage";

/** The Pages Router's 404 (/learn, /demo, /dev/*): the same plain screen as the App Router's not-found. */
export default function Custom404() {
  return (
    <StatusPage
      title="Page not found"
      message="We could not find that page. The link may be old or mistyped."
    />
  );
}
