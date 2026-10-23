import { redirect } from "next/navigation";
import { homeFor, requireProfile } from "@/lib/auth";

export default async function DashboardRedirect() {
  const profile = await requireProfile();
  redirect(homeFor(profile.role));
}
