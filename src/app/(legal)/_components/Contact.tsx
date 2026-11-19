import { operator } from "@/lib/legal/operator";
import { legalLink } from "./LegalPage";

/** The contact address as a link, or a plain "not set yet" while NEXT_PUBLIC_CONTACT_EMAIL is unset. */
export function ContactEmail() {
  if (!operator.email) return <span>[contact address not set]</span>;
  return <a href={`mailto:${operator.email}`} className={legalLink}>{operator.email}</a>;
}

export function OperatorName() {
  return <span>{operator.name ?? "[operator name not set]"}</span>;
}
