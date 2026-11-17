import { StatusPage } from "@/components/system/StatusPage";

export const metadata = { title: "Page not found | Aristo", robots: { index: false } };

export default function NotFound() {
  return (
    <StatusPage
      title="Page not found"
      message="We could not find that page. The link may be old or mistyped."
    />
  );
}
