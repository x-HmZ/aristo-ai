/**
 * /admin → /admin/overview
 *
 * The admin surface is composed of route segments under this directory.
 * See src/components/admin/SidebarNav.tsx for the route map.
 */

import { redirect } from "next/navigation";

export default function AdminIndex() {
  redirect("/admin/overview");
}
