import { redirect } from "next/navigation";

// Old aristo route — redirect to new /learn route
export default function AristoPage() {
  redirect("/learn");
}
